pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./errors/BaseErrors.sol";
import "./errors/AuctionErrors.sol";

import "./libraries/Gas.sol";
import "./libraries/AuctionStatus.sol";

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

import "./flow/fee/MarketFeeOffer.sol";
import "./flow/native_token/SupportNativeTokenOffer.sol";
import "./flow/RoyaltyOffer.sol";
import "./flow/discount/DiscountCollectionOffer.sol";

contract Auction is
    IAcceptTokensTransferCallback,
    IUpgradableByRequest,
    ICallbackParamsStructure,
    IAuctionGasValuesStructure,
    DiscountCollectionOffer,
    MarketFeeOffer,
    SupportNativeTokenOffer,
    RoyaltyOffer
{

    uint128 public price;
    address tokenWallet;

    uint64 auctionStartTime;
    uint64 auctionDuration;
    uint64 auctionEndTime;

    struct AuctionDetails {
        address auctionSubject;
        address subjectOwner;
        address paymentToken;
        address walletForBids;
        uint64 startTime;
        uint64 duration;
        uint64 endTime;
        uint128 price;
        uint64 nonce;
        uint8 status;
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

    uint8 currentStatus;

    uint32 currentVersion;
    AuctionGasValues auctionGas;

    event AuctionCreated(AuctionDetails);
    event AuctionActive(AuctionDetails);
    event BidPlaced(address buyer, uint128 value, uint128 nextBidValue);
    event BidDeclined(address buyer, uint128 value);
    event AuctionComplete(address seller, address buyer, uint128 value);
    event AuctionCancelled();
    event AuctionUpgrade();

    constructor(
        uint128 _price,
        address _collection,
        MarketFee _fee,
        uint64 _auctionStartTime,
        uint64 _auctionDuration,
        uint16 _bidDelta,
        uint16 _bidDeltaDecimals,
        address _remainingGasTo,
        address _weverVault,
        address _weverRoot,
        AuctionGasValues _auctionGas,
        optional(DiscountInfo) _discountOpt
    )
        public
        reserve
    {
        if (
           msg.sender.value != 0 &&
           msg.sender == _getMarketRootAddress() &&
           msg.sender.value >= calcValue(_auctionGas.deployAuction)
        ) {
            price = _price;
            auctionDuration = _auctionDuration;
            auctionStartTime = _auctionStartTime;
            auctionEndTime = _auctionStartTime + _auctionDuration;
            maxBidValue = 0;
            bidDelta = _bidDelta;
            bidDeltaDecimals = _bidDeltaDecimals;
            nextBidValue = price;
            auctionGas = _auctionGas;

            _initialization(
                _fee,
                _weverRoot,
                _weverVault,
                _discountOpt
            );
            if (_getDiscountOpt().hasValue()) {
                _discountAvailabilityCheck();
            }
            _setCollection(_collection);
            _checkRoyaltyFromNFT(calcValue(auctionGas.royalty));

            currentStatus = AuctionStatus.Created;
            emit AuctionCreated(_buildInfo());
            currentVersion++;

            ITokenRoot(_getPaymentToken()).deployWallet {
                value: calcValue(auctionGas.deployWallet),
                flag: 1,
                callback: Auction.onTokenWallet
            }(
                address(this),
                Gas.DEPLOY_EMPTY_WALLET_GRAMS
            );

            _remainingGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
        } else {
            msg.sender.transfer(0, false, 128 + 32);
        }
    }

    function onTokenWallet(
        address value
    )
        external
        reserve
    {
        require(
            msg.sender.value != 0 &&
            msg.sender == _getPaymentToken(),
            BaseErrors.operation_not_permited
        );
        tokenWallet = value;
        _checkAndActivate();
        _getOwner().transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    onBounce(
        TvmSlice _body
    )
        external
        reserve
    {
        uint32 functionId = _body.decode(uint32);
        if (currentStatus == AuctionStatus.Created) {
            _fallbackRoyaltyFromCollection(functionId);
        }
        _getOwner().transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function onAcceptTokensTransfer(
        address tokenRoot,
        uint128 amount,
        address sender,
        address /*sender_wallet*/,
        address originalGasTo,
        TvmCell payload
    )
        external
        override
        reserve
    {
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
            _getPaymentToken() == tokenRoot &&
            now < auctionEndTime &&
            now >= auctionStartTime &&
            currentStatus == AuctionStatus.Active &&
            sender != _getOwner()
        ) {
            _processBid(callbackId, buyer, amount, originalGasTo);
        } else {
            emit BidDeclined(buyer, amount);
            _sendBidResultCallback(callbackId, buyer, false, 0, _getNftAddress());

            TvmCell empty;
            _transfer(_getPaymentToken(), amount, buyer, originalGasTo, msg.sender, 0, 128, uint128(0), empty);
        }
    }

    function getTypeContract()
        external
        pure
        returns (string)
    {
        return "Auction";
    }

    function buildPlaceBidPayload(
        uint32 _callbackId,
        address _buyer
    )
        external
        pure
        responsible
        returns (TvmCell)
    {
        TvmBuilder builder;
        builder.store(_callbackId);
        builder.store(_buyer);
        return { value: 0, bounce: false, flag: 64 } builder.toCell();
    }

    function getInfo()
        external
        view
        returns (AuctionDetails)
    {
        return _buildInfo();
    }

    function finishAuction(
        address _remainingGasTo,
        uint32 _callbackId
    )
        public
        reserve
    {
        require(now >= auctionEndTime, AuctionErrors.auction_still_in_progress);
        require(currentStatus == AuctionStatus.Active, AuctionErrors.auction_not_active);
        require(msg.value >= calcValue(auctionGas.cancel), BaseErrors.not_enough_value);

        mapping(address => CallbackParams) callbacks;
        if (maxBidValue >= price) {
            uint128 currentFee = _getCurrentFee(maxBidValue);
            uint128 currentRoyalty = _getCurrentRoyalty(maxBidValue);
            uint128 balance = _countCorrectFinalPrice(currentFee, currentRoyalty, maxBidValue);

            currentStatus = AuctionStatus.Complete;
            emit AuctionComplete(_getOwner(), currentBid.addr, maxBidValue);

            IAuctionBidPlacedCallback(msg.sender).auctionComplete{
                value: Gas.FRONTENT_CALLBACK_VALUE,
                    flag: 1,
                    bounce: false
            }(
                _callbackId,
                _getNftAddress()
            );

            TvmCell emptyPayload;
            callbacks[currentBid.addr] = CallbackParams(Gas.NFT_CALLBACK_VALUE, emptyPayload);

            ITIP4_1NFT(_getNftAddress()).transfer{
                value: 0,
                flag: 128,
                bounce: false
            }(
                currentBid.addr,
                _remainingGasTo,
                callbacks
            );
            _transfer(
                _getPaymentToken(),
                balance,
                _getOwner(),
                _remainingGasTo,
                tokenWallet,
                Gas.TOKEN_TRANSFER_VALUE,
                1,
                Gas.DEPLOY_EMPTY_WALLET_GRAMS,
                emptyPayload
            );
            if (currentFee >  0) {
                _retentionMarketFee(
                    tokenWallet,
                    Gas.FEE_EXTRA_VALUE,
                    Gas.FEE_DEPLOY_WALLET_GRAMS,
                    currentFee,
                    _remainingGasTo
                );
            }
            if (currentRoyalty > 0) {
                _retentionRoyalty(currentRoyalty, tokenWallet, _remainingGasTo);
            }
        } else {
            emit AuctionCancelled();
            currentStatus = AuctionStatus.Cancelled;
            IAuctionBidPlacedCallback(msg.sender).auctionCancelled{
                value: Gas.FRONTENT_CALLBACK_VALUE,
                flag: 1,
                bounce: false
            }(
                _callbackId,
                _getNftAddress()
            );
            ITIP4_1NFT(_getNftAddress()).changeManager{ value: 0, flag: 128 }(
                _getOwner(),
                _remainingGasTo,
                callbacks
            );
        }
    }

    function _countCorrectFinalPrice(
        uint128 _feeAmount,
        uint128 _royaltyAmount,
        uint128 _price
    )
        internal
        virtual
        returns (uint128)
    {
        uint128 balance = _price;
        if (_price >= _royaltyAmount + _feeAmount) {
            balance = _price - _feeAmount - _royaltyAmount;
        } else {
            balance = _price - _feeAmount;
        }
        return balance;
    }

    function _checkAndActivate()
        internal
        virtual
        override
    {
        if (
            _getRoyalty().hasValue() &&
            tokenWallet.value != 0 &&
            currentStatus == AuctionStatus.Created
            ) {
            currentStatus = AuctionStatus.Active;
            emit AuctionActive(_buildInfo());
        }
    }

    function _afterSetRoyalty()
        internal
        virtual
        override
    {
        _checkAndActivate();
    }

    function _isAllowedSetRoyalty()
        internal
        virtual
        override
        returns (bool)
    {
        return (currentStatus == AuctionStatus.Created);
    }

    function _getTargetBalanceInternal()
        internal
        view
        virtual
        override
        returns (uint128)
    {
        return Gas.AUCTION_INITIAL_BALANCE;
    }

    function _buildInfo()
        private
        view
        returns(AuctionDetails)
    {
        return AuctionDetails({
            auctionSubject: _getNftAddress(),
            subjectOwner: _getOwner(),
            paymentToken: _getPaymentToken(),
            walletForBids: tokenWallet,
            startTime: auctionStartTime,
            duration: auctionDuration,
            endTime: auctionEndTime,
            price: price,
            nonce: _getNonce(),
            status: currentStatus
        });
    }

    function _processBid(
        uint32 _callbackId,
        address _newBidSender,
        uint128 _bid,
        address _originalGasTo
    )
        private
    {
        Bid _currentBid = currentBid;
        Bid newBid = Bid(_newBidSender, _bid);
        maxBidValue = _bid;
        currentBid = newBid;
        _calculateAndSetNextBid();

        emit BidPlaced(_newBidSender, _bid, nextBidValue);
        _sendBidResultCallback(_callbackId, _newBidSender, true, nextBidValue, _getNftAddress());

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
                _getNftAddress()
            );

            TvmBuilder builder;
            builder.store(_callbackId);
            builder.store(currentBid.addr);
            builder.store(currentBid.value);
            _transfer(_getPaymentToken(), _currentBid.value, _currentBid.addr, _originalGasTo, msg.sender, 0, 128, uint128(0), builder.toCell());

        } else {
            _originalGasTo.transfer({ value: 0, flag: 128, bounce: false });
        }
    }

    function _calculateAndSetNextBid()
        private
    {
        nextBidValue = maxBidValue + math.muldivc(maxBidValue, uint128(bidDelta), uint128(bidDeltaDecimals));
    }

    function _sendBidResultCallback(
        uint32 _callbackId,
        address _callbackTarget,
        bool _isBidPlaced,
        uint128 _nextBidValue,
        address _nft
    )
        private
        pure
    {
        if(_callbackTarget.value != 0) {
            if (_isBidPlaced) {
                IAuctionBidPlacedCallback(_callbackTarget).bidPlacedCallback{
                    value: Gas.FRONTENT_CALLBACK_VALUE,
                    flag: 1,
                    bounce: false
                }(
                    _callbackId,
                    _nextBidValue,
                    _nft
                );
            } else {
                IAuctionBidPlacedCallback(_callbackTarget).bidNotPlacedCallback{
                    value: Gas.FRONTENT_CALLBACK_VALUE,
                    flag: 1,
                    bounce: false
                }(
                    _callbackId,
                    _nft
                );
            }
        }
    }

    function upgrade(
        TvmCell newCode,
        uint32 newVersion,
        address remainingGasTo
    )
        external
        override
        onlyMarketRoot
        reserve
    {
        if (currentVersion == newVersion) {
			remainingGasTo.transfer({
				value: 0,
				flag: 128 + 2,
				bounce: false
			});
		} else {
            emit AuctionUpgrade();

            TvmCell cellParams = abi.encode(
                _getNonce(),
                _getNftAddress(),
                price,
                currentVersion,
                _getMarketRootAddress(),
                _getCollection(),
                _getOwner(),
                _getMarketFee(),
                auctionDuration,
                auctionStartTime,
                auctionEndTime,
                bidDelta,
                bidDeltaDecimals,
                currentBid,
                maxBidValue,
                nextBidValue,
                _getPaymentToken(),
                tokenWallet,
                currentStatus,
                _getWeverVault(),
                _getWeverRoot(),
                auctionGas,
                _getDiscountOpt(),
                _getDiscountNft(),
                _getRoyalty()
            );

            tvm.setcode(newCode);
            tvm.setCurrentCode(newCode);

            onCodeUpgrade(cellParams);
        }
    }

    function onCodeUpgrade(TvmCell data) private {}

}
