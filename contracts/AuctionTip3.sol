pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import './abstract/Offer.sol';

import "./errors/BaseErrors.sol";
import "./errors/AuctionErrors.sol";

import "./libraries/Gas.sol";

import "./interfaces/IUpgradableByRequest.sol";
import "./interfaces/IAuctionBidPlacedCallback.sol";

import "./structures/IAuctionGasValuesStructure.sol";

import "./modules/TIP4_1/interfaces/INftChangeManager.sol";
import "./modules/TIP4_1/interfaces/ITIP4_1NFT.sol";
import "./modules/TIP4_1/structures/ICallbackParamsStructure.sol";

import "./Nft.sol";

import "tip3/contracts/interfaces/ITokenRoot.sol";
import "tip3/contracts/interfaces/ITokenWallet.sol";
import "tip3/contracts/interfaces/IAcceptTokensTransferCallback.sol";

contract AuctionTip3 is Offer, IAcceptTokensTransferCallback, IUpgradableByRequest, ICallbackParamsStructure, IAuctionGasValuesStructure {

    address paymentToken;
    address tokenWallet;

    uint64 auctionStartTime;
    uint64 auctionDuration;
    uint64 auctionEndTime;

    struct AuctionDetails {
        address auctionSubject;
        address subjectOwner;
        address _paymentToken;
        address walletForBids;
        uint64 startTime;
        uint64 duration;
        uint64 finishTime;
        uint128 _price;
        uint64 _nonce;
        AuctionStatus status;
    }

    struct Bid {
        address addr;
        uint128 value;
    }

    uint16 public bidDelta;
    uint16 public bidDeltaDecimals;
    Bid public currentBid;
    uint128 public maxBidValue;
    uint128 public nextBidValue;

    enum AuctionStatus {
        Created,
        Active,
        Complete,
        Cancelled
    }
    AuctionStatus state;

    uint32 currentVersion;
    address public weverVault;
    address public weverRoot;
    AuctionGasValues auctionGas;

    event AuctionCreated(AuctionDetails);
    event AuctionActive(AuctionDetails);
    event BidPlaced(address buyer, uint128 value, uint128 nextBidValue);
    event BidDeclined(address buyer, uint128 value);
    event AuctionComplete(address seller, address buyer, uint128 value);
    event AuctionCancelled();
    event AuctionUpgrade();
    event MarketFeeWithheld(uint128 amount, address tokenRoot);

    constructor(
        uint128 _price,
        address _tokenRootAddr,
        address _nftOwner,
        uint128 _deploymentFee,
        MarketFee _fee,
        uint64 _auctionStartTime,
        uint64 _auctionDuration,
        uint16 _bidDelta,
        uint16 _bidDeltaDecimals,
        address _paymentToken,
        address sendGasTo,
        address _weverVault,
        address _weverRoot,
        AuctionGasValues _auctionGas
    ) public {
        if (
           msg.sender.value != 0 &&
           msg.sender == markerRootAddr &&
           msg.sender.value >= calcValue(_auctionGas.deployAuction)
        ) {
            _reserve();
            setDefaultProperties (
                _price,
                _tokenRootAddr,
                _nftOwner,
                _deploymentFee,
                _fee
            );
            auctionDuration = _auctionDuration;
            auctionStartTime = _auctionStartTime;
            auctionEndTime = _auctionStartTime + _auctionDuration;
            maxBidValue = 0;
            bidDelta = _bidDelta;
            bidDeltaDecimals = _bidDeltaDecimals;
            nextBidValue = price;
            paymentToken = _paymentToken;
            weverVault = _weverVault;
            weverRoot = _weverRoot;
            auctionGas = _auctionGas;

            emit AuctionCreated(buildInfo());
            state = AuctionStatus.Created;
            currentVersion++;

            ITokenRoot(paymentToken).deployWallet {
                value: calcValue(auctionGas.deployWallet),
                flag: 1,
                callback: AuctionTip3.onTokenWallet
            }(
                address(this),
                Gas.DEPLOY_EMPTY_WALLET_GRAMS
            );

            sendGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
        } else {
            msg.sender.transfer(0, false, 128 + 32);
        }
    }

    function onTokenWallet(address value) external {
        require(
            msg.sender.value != 0 &&
            msg.sender == paymentToken,
            BaseErrors.operation_not_permited
        );
        _reserve();
        tokenWallet = value;
        emit AuctionActive(buildInfo());
        state = AuctionStatus.Active;
        nftOwner.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function _reserve() internal override {
        tvm.rawReserve(Gas.AUCTION_INITIAL_BALANCE, 0);
    }

    function calcValue(IGasValueStructure.GasValues value) internal pure returns(uint128) {
        return value.fixedValue + gasToValue(value.dynamicGas, address(this).wid);
    }

    function getTypeContract() external pure returns (string) {
        return "Auction";
    }

    function onAcceptTokensTransfer(
        address token_root,
        uint128 amount,
        address sender,
        address /*sender_wallet*/,
        address original_gas_to,
        TvmCell payload
    ) override external {
        _reserve();

        uint32 callbackId = 0;
        address buyer = sender;
        TvmSlice payloadSlice = payload.toSlice();
        if (payloadSlice.bits() >= 32) {
            callbackId = payloadSlice.decode(uint32);
        }
        if (payloadSlice.bits() >= 267) {
            buyer = payloadSlice.decode(address);
        }
        if (
            msg.value >= calcValue(auctionGas.bid) &&
            amount >= nextBidValue &&
            msg.sender == tokenWallet &&
            msg.sender.value != 0 &&
            paymentToken == token_root &&
            now < auctionEndTime &&
            now >= auctionStartTime &&
            state == AuctionStatus.Active &&
            sender != nftOwner
        ) {
            processBid(callbackId, buyer, amount, original_gas_to);
        } else {
            emit BidDeclined(buyer, amount);
            sendBidResultCallback(callbackId, buyer, false, 0, nft);

            TvmCell empty;
            _transfer(amount, buyer, original_gas_to, msg.sender, 0, 128, uint128(0), empty);
        }
    }

    function processBid(
        uint32 _callbackId,
        address _newBidSender,
        uint128 _bid,
        address original_gas_to
    ) private {
        Bid _currentBid = currentBid;
        Bid newBid = Bid(_newBidSender, _bid);
        maxBidValue = _bid;
        currentBid = newBid;
        calculateAndSetNextBid();

        emit BidPlaced(_newBidSender, _bid, nextBidValue);
        sendBidResultCallback(_callbackId, _newBidSender, true, nextBidValue, nft);

        // Return lowest bid value to the bidder's address
        if (_currentBid.value > 0) {
            IAuctionBidPlacedCallback(_currentBid.addr).bidRaisedCallback{
                value: Gas.FRONTENT_CALLBACK_VALUE,
                flag: 1,
                bounce: false
            }(
                _callbackId,
                currentBid.addr,
                currentBid.value,
                nft
            );

            TvmBuilder builder;
            builder.store(_callbackId);
            builder.store(currentBid.addr);
            builder.store(currentBid.value);
            _transfer(_currentBid.value, _currentBid.addr, original_gas_to, msg.sender, 0, 128, uint128(0), builder.toCell());

        } else {
            original_gas_to.transfer({ value: 0, flag: 128, bounce: false });
        }
    }

    function _transfer(uint128 amount, address user, address remainingGasTo, address sender, uint128 value, uint16 flag, uint128 gasDeployTW, TvmCell payload) private {
        TvmBuilder builder;
        builder.store(remainingGasTo);
        TvmCell emptyPayload;
        if (paymentToken == weverRoot) {
            ITokenWallet(sender).transfer{ value: value, flag: flag, bounce: false }(
                amount,
                weverVault,
                uint128(0),
                user,
                true,
                builder.toCell()
            );
        } else {
            ITokenWallet(sender).transfer{ value: value, flag: flag, bounce: false }(
                amount,
                user,
                gasDeployTW,
                remainingGasTo,
                false,
                payload
            );
        }
    }

    function onAcceptTokensBurn(
        uint128 amount,
        address /*walletOwner*/,
        address /*wallet*/,
        address user,
        TvmCell payload
    )  external {
        address remainingGasTo;
        TvmSlice payloadSlice = payload.toSlice();
        if (payloadSlice.bits() >= 267) {
            remainingGasTo = payloadSlice.decode(address);
        }
        require(msg.sender.value != 0 && msg.sender == weverRoot, BaseErrors.not_wever_root);
        _reserve();

        if (user == remainingGasTo) {
            user.transfer({ value: 0, flag: 128 + 2, bounce: false });
        } else {
            user.transfer({ value: amount, flag: 1, bounce: false });
            remainingGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
        }
   }

    function finishAuction(
        address sendGasTo,
        uint32 callbackId
    ) public {
        require(now >= auctionEndTime, AuctionErrors.auction_still_in_progress);
        require(state == AuctionStatus.Active, AuctionErrors.auction_not_active);
        require(msg.value >= calcValue(auctionGas.cancel), BaseErrors.not_enough_value);
        mapping(address => CallbackParams) callbacks;
        if (maxBidValue >= price) {
            _reserve();
            uint128 currentFee = math.muldivc(maxBidValue, fee.numerator, fee.denominator);
            uint128 balance = maxBidValue - currentFee;

            emit AuctionComplete(nftOwner, currentBid.addr, maxBidValue);
            state = AuctionStatus.Complete;

            IAuctionBidPlacedCallback(msg.sender).auctionComplete{
                value: Gas.FRONTENT_CALLBACK_VALUE,
                    flag: 1,
                    bounce: false
            }(
                callbackId,
                nft
            );

            TvmCell empty;
            callbacks[currentBid.addr] = CallbackParams(Gas.NFT_CALLBACK_VALUE, empty);

            ITIP4_1NFT(nft).transfer{
                value: 0,
                flag: 128,
                bounce: false
            }(
                currentBid.addr,
                sendGasTo,
                callbacks
            );
            _transfer(balance, nftOwner, sendGasTo, tokenWallet, Gas.TOKEN_TRANSFER_VALUE, 1, Gas.DEPLOY_EMPTY_WALLET_GRAMS, empty);

            if (currentFee >  0) {
                emit MarketFeeWithheld(currentFee, paymentToken);
                ITokenWallet(tokenWallet).transfer{
                    value: Gas.FEE_DEPLOY_WALLET_GRAMS + Gas.FEE_EXTRA_VALUE,
                    flag: 0,
                    bounce: false
                }(
                    currentFee,
                    markerRootAddr,
                    Gas.FEE_DEPLOY_WALLET_GRAMS,
                    sendGasTo,
                    false,
                    empty
                );
            }

        } else {
            emit AuctionCancelled();
            state = AuctionStatus.Cancelled;
            IAuctionBidPlacedCallback(msg.sender).auctionCancelled{
                value: Gas.FRONTENT_CALLBACK_VALUE,
                flag: 1,
                bounce: false
            }(
                callbackId,
                nft
            );
            ITIP4_1NFT(nft).changeManager{ value: 0, flag: 128 }(
                nftOwner,
                sendGasTo,
                callbacks
            );
        }
    }

    function calculateAndSetNextBid() private {
        nextBidValue = maxBidValue + math.muldivc(maxBidValue, uint128(bidDelta), uint128(bidDeltaDecimals));
    }

    function sendBidResultCallback(
        uint32 callbackId,
        address _callbackTarget,
        bool _isBidPlaced,
        uint128 _nextBidValue,
        address _nft
    ) private pure {
        if(_callbackTarget.value != 0) {
            if (_isBidPlaced) {
                IAuctionBidPlacedCallback(_callbackTarget).bidPlacedCallback{
                    value: Gas.FRONTENT_CALLBACK_VALUE,
                    flag: 1,
                    bounce: false
                }(
                    callbackId,
                    _nextBidValue,
                    _nft
                );
            } else {
                IAuctionBidPlacedCallback(_callbackTarget).bidNotPlacedCallback{
                    value: Gas.FRONTENT_CALLBACK_VALUE,
                    flag: 1,
                    bounce: false
                }(
                    callbackId,
                    _nft
                );
            }
        }
    }

    function buildPlaceBidPayload(
        uint32 callbackId,
        address buyer
    ) external pure responsible returns (TvmCell) {
        TvmBuilder builder;
        builder.store(callbackId);
        builder.store(buyer);
        return { value: 0, bounce: false, flag: 64 } builder.toCell();
    }

    function getInfo() external view returns (AuctionDetails) {
        return buildInfo();
    }

    function buildInfo() private view returns(AuctionDetails) {
        return AuctionDetails(
            nft,
            nftOwner,
            paymentToken,
            tokenWallet,
            auctionStartTime,
            auctionDuration,
            auctionEndTime,
            price,
            nonce_,
            state
        );
    }

    function upgrade(
        TvmCell newCode,
        uint32 newVersion,
        address sendGasTo
    ) override external onlyMarketRoot {
        if (currentVersion == newVersion) {
			_reserve();
			sendGasTo.transfer({
				value: 0,
				flag: 128 + 2,
				bounce: false
			});
		} else {
            emit AuctionUpgrade();

            TvmCell cellParams = abi.encode(
              nonce_,
              nft,
              price,
              currentVersion,
              markerRootAddr,
              tokenRootAddr,
              nftOwner,
              deploymentFee,
              fee,
              auctionDuration,
              auctionStartTime,
              auctionEndTime,
              bidDelta,
              bidDeltaDecimals,
              currentBid,
              maxBidValue,
              nextBidValue,
              paymentToken,
              tokenWallet,
              state,
              weverVault,
              weverRoot,
              auctionGas
            );

            tvm.setcode(newCode);
            tvm.setCurrentCode(newCode);

            onCodeUpgrade(cellParams);
        }
    }

    function onCodeUpgrade(TvmCell data) private {}

}
