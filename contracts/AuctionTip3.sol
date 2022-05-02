pragma ton-solidity >=0.57.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import './libraries/Gas.sol';

import './abstract/Offer.sol';

import 'ton-eth-bridge-token-contracts/contracts//interfaces/ITokenRoot.sol';
import 'ton-eth-bridge-token-contracts/contracts//interfaces/ITokenWallet.sol';
import 'ton-eth-bridge-token-contracts/contracts//interfaces/IAcceptTokensTransferCallback.sol';
import './modules/TIP4_1/interfaces/INftChangeManager.sol';
import './modules/TIP4_1/interfaces/ITIP4_1NFT.sol';

import './interfaces/IAuctionBidPlacedCallback.sol';

import './errors/AuctionErrors.sol';
import './errors/BaseErrors.sol';

contract AuctionTip3 is Offer, IAcceptTokensTransferCallback {
    
    address paymentTokenRoot;
    address tokenWallet;

    uint64 auctionStartTime; // it can be suited to 32, but who cares?
    uint64 auctionDuration;
    uint64 auctionEndTime;

    struct AuctionDetails {
        address auctionSubject;
        address subjectOwner;
        address paymentTokenRoot;
        address walletForBids;
        uint64 startTime;
        uint64 duration;
        uint64 finishTime;
    }

    struct Bid {
        address addr;
        uint128 value;
    }

    uint8 public bidDelta;
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

    event BidPlaced(address buyerAddress, uint128 value);
    event BidDeclined(address buyerAddress, uint128 value);

    constructor(
        address _markerRootAddr,
        address _tokenRootAddr,
        address _nftOwner,
        uint128 _deploymentFee,
        uint128 _marketFee,
        uint8 _marketFeeDecimals,
        uint64 _auctionStartTime,
        uint64 _auctionDuration, 
        uint8 _bidDelta,
        address _paymentTokenRoot,
        address sendGasTo
    ) public {
        tvm.rawReserve(Gas.AUCTION_INITIAL_BALANCE, 0);
        setDefaultProperties(
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
        paymentTokenRoot = _paymentTokenRoot;
        state = AuctionStatus.Created;

        ITokenRoot(paymentTokenRoot).deployWallet {
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
        require(msg.sender.value != 0 && msg.sender == paymentTokenRoot, BaseErrors.operation_not_permited);
        tvm.rawReserve(Gas.AUCTION_INITIAL_BALANCE, 0);
        tokenWallet = value;
        state = AuctionStatus.Active;
        tokenWallet.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function onAcceptTokensTransfer(
        address token_root,				
        uint128 amount,					
        address sender,			 
        address sender_wallet,			
        address original_gas_to,		
        TvmCell payload					
    ) override external {
        tvm.rawReserve(Gas.AUCTION_INITIAL_BALANCE, 0);
        if (
            msg.value >= Gas.TOKENS_RECEIVED_CALLBACK_VALUE &&
            amount >= nextBidValue &&
            msg.sender == tokenWallet &&
            tokenWallet.value != 0 &&
            paymentTokenRoot == token_root && 
            now < auctionEndTime &&
            now >= auctionStartTime &&
            state == AuctionStatus.Active
        ) {
            processBid(sender, amount, payload, original_gas_to);
        } else {
            emit BidDeclined(sender, amount);
            sendBidResultCallback(sender, payload, false);
            TvmCell empty;
            ITokenWallet(msg.sender).transfer{ value: 0, flag: 128 }(
                amount,
                sender,
                0,
                original_gas_to,
                true,
                payload
            );   
        }
    }

    function processBid(
        address _newBidSender,
        uint128 _bid,
        TvmCell _callbackPayload,
        address original_gas_to
    ) private {
        tvm.rawReserve(Gas.AUCTION_INITIAL_BALANCE, 0);
        Bid _currentBid = currentBid;
        Bid newBid = Bid(_newBidSender, _bid);
        maxBidValue = _bid;
        currentBid = newBid;
        calculateAndSetNextBid();
        emit BidPlaced(_newBidSender, _bid);
        sendBidResultCallback(_newBidSender, _callbackPayload, true);
        // Return lowest bid value to the bidder's address
        if (_currentBid.value > 0) {
            TvmCell empty;
            ITokenWallet(msg.sender).transfer{ value: 0, flag: 128 }(
                _currentBid.value,
                _currentBid.addr,
                0,
                original_gas_to,
                false,
                empty
            );
        } else {
            original_gas_to.transfer({ value: 0, flag: 128 });
        }
    }

    function finishAuction(
        address sendGasTo
    ) public {
        require(now >= auctionEndTime, AuctionErrors.auction_still_in_progress);
        require(msg.value >= Gas.FINISH_AUCTION_VALUE, BaseErrors.not_enough_value);
        mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
        if (maxBidValue >= price) {
            TvmCell empty;
            ITIP4_1NFT(nft).transfer{value: Gas.TRANSFER_OWNERSHIP_VALUE, flag: 1}(
                currentBid.addr,
                sendGasTo,
                callbacks
            );
            ITokenWallet(tokenWallet).transfer{ value: 0, flag: 64 }(
                maxBidValue,
                nftOwner,
                Gas.DEPLOY_EMPTY_WALLET_GRAMS,
                sendGasTo,
                false,
                empty
            );
            state = AuctionStatus.Complete;
        } else {
            state = AuctionStatus.Cancelled;
            TvmCell empty;
            ITIP4_1NFT(nft).transfer{value: 0, flag: 64}(
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
        address _callbackTarget,
        TvmCell _payload,
        bool _isBidPlaced
    ) private {
        if(_callbackTarget.value != 0) {
            uint32 callbackId = 404;
            if (_payload.toSlice().bits() >= 32) {
                callbackId = _payload.toSlice().decode(uint32);
            }
            if (_isBidPlaced) {
                IAuctionBidPlacedCallback(_callbackTarget).bidPlacedCallback{value: 1, flag: 1, bounce: false}(callbackId);
            } else {
                IAuctionBidPlacedCallback(_callbackTarget).bidNotPlacedCallback{value: 2, flag: 1, bounce: false}(callbackId);
            }
        }
    }

    function buildPlaceBidPayload(uint32 callbackId) external pure responsible returns (TvmCell) {
        TvmBuilder builder;
        builder.store(callbackId);
        return builder.toCell();
    }

    function getInfo() external view responsible returns (AuctionDetails) {
        return AuctionDetails(nft, nftOwner, paymentTokenRoot, tokenWallet, auctionStartTime, auctionDuration, auctionEndTime);
    }
}
