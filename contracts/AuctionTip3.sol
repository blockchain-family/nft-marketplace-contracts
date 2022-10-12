pragma ever-solidity >= 0.62.0;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import './abstract/Offer.sol';

import "./errors/BaseErrors.sol";
import "./errors/AuctionErrors.sol";

import "./libraries/Gas.sol";
import "./libraries/ExchangePayload.sol";

import "./interfaces/IUpgradableByRequest.sol";
import "./interfaces/IAuctionBidPlacedCallback.sol";

import "./modules/TIP4_1/interfaces/INftChangeManager.sol";
import "./modules/TIP4_1/interfaces/ITIP4_1NFT.sol";

import "./Nft.sol";

import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenRoot.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenWallet.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";

contract AuctionTip3 is Offer, IAcceptTokensTransferCallback, IUpgradableByRequest {
    
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

    event AuctionCreated(AuctionDetails);
    event AuctionActive(AuctionDetails);
    event BidPlaced(address buyer, uint128 value, uint128 nextBidValue);
    event BidDeclined(address buyer, uint128 value);
    event AuctionComplete(address seller, address buyer, uint128 value); 
    event AuctionCancelled();
    event AuctionUpgrade();

    constructor(
        uint128 _price,
        address _markerRootAddr,
        address _tokenRootAddr,
        address _nftOwner,
        uint128 _deploymentFee,
        uint128 _marketFee,
        uint8 _marketFeeDecimals,
        uint64 _auctionStartTime,
        uint64 _auctionDuration, 
        uint16 _bidDelta,
        address _paymentToken,
        address sendGasTo
    ) public {
        tvm.rawReserve(Gas.AUCTION_INITIAL_BALANCE, 0);
        setDefaultProperties(
            _price,
            _markerRootAddr, 
            _tokenRootAddr, 
            _nftOwner,
            _deploymentFee, 
            _marketFee, 
            _marketFeeDecimals
        );

        auctionDuration = _auctionDuration;
        auctionStartTime = _auctionStartTime;
        auctionEndTime = _auctionStartTime + _auctionDuration;
        maxBidValue = 0;
        bidDelta = _bidDelta;
        nextBidValue = price;
        paymentToken = _paymentToken;
        
        emit AuctionCreated(buildInfo());
        state = AuctionStatus.Created;
        currentVersion++;
        
        ITokenRoot(paymentToken).deployWallet {
            value: Gas.DEPLOY_EMPTY_WALLET_VALUE,
            flag: 1,
            callback: AuctionTip3.onTokenWallet
        }(
            address(this),
            Gas.DEPLOY_EMPTY_WALLET_GRAMS
        );

        sendGasTo.transfer({ value: 0, flag: 128, bounce: false });
    }

    function onTokenWallet(address value) external {
        require(
            msg.sender.value != 0 && 
            msg.sender == paymentToken, 
            BaseErrors.operation_not_permited
        );

        tvm.rawReserve(Gas.AUCTION_INITIAL_BALANCE, 0);
        tokenWallet = value;

        emit AuctionActive(buildInfo());
        state = AuctionStatus.Active;

        tokenWallet.transfer({ value: 0, flag: 128 + 2, bounce: false });
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
        tvm.rawReserve(Gas.AUCTION_INITIAL_BALANCE, 0);
        
        (address buyer, uint32 callbackId) = ExchangePayload.getSenderAndCallId(sender, payload);
        if (
            msg.value >= Gas.TOKENS_RECEIVED_CALLBACK_VALUE &&
            amount >= nextBidValue &&
            msg.sender == tokenWallet &&
            tokenWallet.value != 0 &&
            paymentToken == token_root && 
            now < auctionEndTime &&
            now >= auctionStartTime &&
            state == AuctionStatus.Active
        ) {
            processBid(callbackId, buyer, amount, original_gas_to, nextBidValue);
        } else {
            emit BidDeclined(buyer, amount);
            sendBidResultCallback(callbackId, buyer, false, 0);
            TvmCell empty;
            ITokenWallet(msg.sender).transfer{ value: 0, flag: 128, bounce: false }(
                amount,
                buyer,
                Gas.DEPLOY_EMPTY_WALLET_GRAMS,
                original_gas_to,
                true,
                empty
            );
        }
    }

    function processBid(
        uint32 _callbackId,
        address _newBidSender,
        uint128 _bid,
        address original_gas_to,
        uint128 _nextBidValue
    ) private {
        tvm.rawReserve(Gas.AUCTION_INITIAL_BALANCE, 0);
        Bid _currentBid = currentBid;
        Bid newBid = Bid(_newBidSender, _bid);
        maxBidValue = _bid;
        currentBid = newBid;
        calculateAndSetNextBid();

        emit BidPlaced(_newBidSender, _bid, _nextBidValue);
        sendBidResultCallback(_callbackId, _newBidSender, true, _nextBidValue);
        // Return lowest bid value to the bidder's address
        if (_currentBid.value > 0) {
            IAuctionBidPlacedCallback(_currentBid.addr).bidRaisedCallback{
                value: 0.1 ever, 
                flag: 1, 
                bounce: false 
            }(
                _callbackId,
                currentBid.addr,
                currentBid.value
            );

            TvmBuilder builder;
            builder.store(_callbackId);
            builder.store(currentBid.addr);
            builder.store(currentBid.value);
            
            ITokenWallet(msg.sender).transfer{ value: 0, flag: 128, bounce: false }(
                _currentBid.value,
                _currentBid.addr,
                Gas.DEPLOY_EMPTY_WALLET_GRAMS,
                original_gas_to,
                false,
                builder.toCell()
            );
        } else {
            original_gas_to.transfer({ value: 0, flag: 128, bounce: false });
        }
    }

    function finishAuction(
        address sendGasTo
    ) public {
        require(now >= auctionEndTime, AuctionErrors.auction_still_in_progress);
        require(msg.value >= Gas.FINISH_AUCTION_VALUE, BaseErrors.not_enough_value);
        mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
        if (maxBidValue >= price) {
            
            emit AuctionComplete(nftOwner, currentBid.addr, maxBidValue);
            state = AuctionStatus.Complete;

            ITIP4_1NFT(nft).transfer{
                value: Gas.TRANSFER_OWNERSHIP_VALUE, 
                flag: 1, 
                bounce: false
            }(
                currentBid.addr,
                sendGasTo,
                callbacks
            );
            
            TvmCell empty;
            ITokenWallet(tokenWallet).transfer{ value: 0, flag: 128, bounce: false }(
                maxBidValue,
                nftOwner,
                Gas.DEPLOY_EMPTY_WALLET_GRAMS,
                sendGasTo,
                false,
                empty
            );
        } else {
            emit AuctionCancelled();
            state = AuctionStatus.Cancelled;
            
            ITIP4_1NFT(nft).changeManager{ value: 0, flag: 128 }(
                    nftOwner,
                    sendGasTo,
                    callbacks
            );
        }
    }

    function calculateAndSetNextBid() private {
        nextBidValue = maxBidValue + math.muldivc(maxBidValue, uint128(bidDelta), uint128(10000));
    }

    function sendBidResultCallback(
        uint32 callbackId,
        address _callbackTarget,
        bool _isBidPlaced,
        uint128 _nextBidValue
    ) private pure {
        if(_callbackTarget.value != 0) {
            if (_isBidPlaced) {
                IAuctionBidPlacedCallback(_callbackTarget).bidPlacedCallback{
                    value: 0.1 ever, 
                    flag: 1, 
                    bounce: false 
                }(
                    callbackId,
                    _nextBidValue
                );
            } else {
                IAuctionBidPlacedCallback(_callbackTarget).bidNotPlacedCallback{
                    value: 0.1 ever,
                    flag: 1, 
                    bounce: false 
                }(
                    callbackId
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
			tvm.rawReserve(Gas.AUCTION_INITIAL_BALANCE, 0);
			sendGasTo.transfer({
				value: 0,
				flag: 128 + 2,
				bounce: false
			});
		} else {
            emit AuctionUpgrade();

            TvmCell cellParams = abi.encode(
              nonce_,
              currentVersion,
              price,
              nft,
              markerRootAddr,
              tokenRootAddr,
              nftOwner,
              deploymentFee,
              marketFee,
              marketFeeDecimals,
              auctionDuration,
              auctionStartTime,
              auctionEndTime,
              maxBidValue,
              bidDelta,
              nextBidValue,
              paymentToken,
              state
            );
            
            tvm.setcode(newCode);
            tvm.setCurrentCode(newCode);

            onCodeUpgrade(cellParams);
        }
    }

    function onCodeUpgrade(TvmCell data) private {}

}
