pragma ever-solidity >= 0.62.0;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import './abstract/OffersRoot.sol';

import './errors/BaseErrors.sol';
import './errors/AuctionErrors.sol';


import './libraries/Gas.sol';

import "./interfaces/IAuctionRootCallback.sol";
import "./interfaces/IUpgradableByRequest.sol";

import './modules/TIP4_1/interfaces/INftChangeManager.sol';
import './modules/TIP4_1/interfaces/ITIP4_1NFT.sol';

import './Nft.sol';
import './AuctionTip3.sol';

contract AuctionRootTip3 is OffersRoot, INftChangeManager {

    uint64 static nonce_;

    struct MarketOffer {
        address collection;
        address nftOwner;
        address nft;
        address offer;
        uint128 price;
        uint128 auctionDuration;
        uint64 deployNonce;
    }

    uint32 currentVersion;
    uint32 currentVersionOffer;

    event AuctionDeployed(address offer, MarketOffer offerInfo);
    event AuctionDeclined(address nftOwner, address nft);
    event AuctionRootUpgrade();

    constructor(
        TvmCell _codeNft,
        address _owner,
        TvmCell _offerCode,
        uint128 _deploymentFee,
        uint32 _marketFeeNumerator,
        uint32 _marketFeeDenominator,
        uint16 _auctionBidDelta,
        uint16 _auctionBidDeltaDecimals,
        address _sendGasTo
    ) OwnableInternal(
        _owner
    )
        public 
    {
        tvm.accept();
        tvm.rawReserve(Gas.AUCTION_ROOT_INITIAL_BALANCE, 0);
        // Method and properties are declared in OffersRoot
        setDefaultProperties(
            _codeNft,
            _owner,
            _offerCode,
            _deploymentFee,
            _marketFeeNumerator,
            _marketFeeDenominator,
            _auctionBidDelta,
            _auctionBidDeltaDecimals
        );

        currentVersion++;
        currentVersionOffer++;

        _sendGasTo.transfer({ value: 0, flag: 128, bounce: false });
    }

    function getTypeContract() external pure returns (string) {
        return "AuctionRoot";
    }

    function getMarketFee() external pure returns (uint32, uint32) {
        return (marketFeeNumerator, marketFeeDenominator);
    }

    function onNftChangeManager(
        uint256 /*id*/,
        address nftOwner,
        address /*oldManager*/,
        address newManager,
        address collection,
        address sendGasTo,
        TvmCell payload
    ) external override {
        require(newManager == address(this));
        tvm.rawReserve(Gas.AUCTION_ROOT_INITIAL_BALANCE, 0);
        bool isDeclined = false;

        TvmSlice payloadSlice = payload.toSlice();
        (, uint32 callbackId) = ExchangePayload.getSenderAndCallId(address(0), payload);
        if (payloadSlice.bits() == 555) {
            (  ,address paymentToken,
                uint128 price,
                uint64 auctionStartTime,
                uint64 auctionDuration
            ) = payloadSlice.decode(uint32, address, uint128, uint64, uint64);
            if (
                paymentToken.value > 0 &&
                price >= 0 &&
                auctionStartTime > 0 &&
                auctionDuration > 0 
            ) {
                address offerAddress = new AuctionTip3 {
                    wid: address(this).wid,
                    value: Gas.DEPLOY_AUCTION_VALUE,
                    flag: 1,
                    code: offerCode,
                    varInit: {
                        nonce_: tx.timestamp,
                        nft: msg.sender
                    }
                }(
                    price,
                    address(this),
                    collection,
                    nftOwner,
                    deploymentFeePart * 2,
                    marketFeeNumerator,
                    marketFeeDenominator,
                    auctionStartTime, 
                    auctionDuration,
                    auctionBidDelta,
                    auctionBidDeltaDecimals,
                    paymentToken,
                    nftOwner
                );

                MarketOffer offerInfo = MarketOffer(
                    collection, 
                    nftOwner, 
                    msg.sender, 
                    offerAddress,
                    price,
                    auctionDuration,
                    tx.timestamp
                );
                
                emit AuctionDeployed(offerAddress, offerInfo);
                IAuctionRootCallback(nftOwner).auctionTip3DeployedCallback{
                     value: Gas.CALLBACK_VALUE, 
                     flag: 1, 
                     bounce: false 
                }(
                    callbackId,
                    offerAddress,
                    offerInfo
                );

                mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
                ITIP4_1NFT(msg.sender).changeManager{ value: 0, flag: 128 }(
                    offerAddress,
                    sendGasTo,
                    callbacks
                );
            } else {
                isDeclined = true;
            }
        } else {
            isDeclined = true;
        }
        
        if (isDeclined) {
            emit AuctionDeclined(nftOwner, msg.sender);
            IAuctionRootCallback(nftOwner).auctionTip3DeployedDeclined{
                value: Gas.CALLBACK_VALUE, 
                flag: 1, 
                bounce: false 
            }(
                callbackId,
                nftOwner,
                msg.sender
            );

            mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
            ITIP4_1NFT(msg.sender).changeManager{ value: 0, flag: 128 }(
                nftOwner,
                sendGasTo,
                callbacks
            );
        }
    }

    function getOfferAddress(
        address _nft,
        uint64 _nonce
    ) 
        internal 
        view 
        returns (address)
    {
        TvmCell data = tvm.buildStateInit({
            contr: AuctionTip3,
            code: offerCode,
            varInit: {
                nonce_: _nonce,
                nft: _nft
            }
        });

        return address(tvm.hash(data));
    }

    function buildAuctionCreationPayload(
        uint32 callbackId,
        address paymentToken,
        uint128 price,
        uint64 auctionStartTime,
        uint64 auctionDuration
    ) external pure responsible returns(TvmCell) {
        TvmBuilder builder;
        builder.store(callbackId);
        builder.store(paymentToken);
        builder.store(price);
        builder.store(auctionStartTime);
        builder.store(auctionDuration);
        return { value: 0, bounce: false, flag: 64 } builder.toCell();
    }

    function widhraw(address tokenWallet, uint128 amount, address recipien, address remainingGasTo) external view onlyOwner {
        require(recipient.value != 0, AuctionErrors.wrong_recipient);
        require(msg.value >= Gas.WITHDRAW_VALUE, AuctionErrors.low_gas);

        tvm.rawReserve(Gas.AUCTION_ROOT_INITIAL_BALANCE, 0);
        TvmCell emptyPayload;
        ITokenWallet(tokenWallet).transfer{value: 0, flag: 128, bounce: false }
            (amount, recipient, Gas.DEPLOY_EMPTY_WALLET_GRAMS, remainingGasTo, true, emptyPayload);
    }

    function RequestUpgradeAuction(
        address _nft,
        uint64 _nonce,
        address sendGasTo
    ) external view onlyOwner {
        require(msg.value >= Gas.UPGRADE_AUCTION_ROOT_MIN_VALUE, BaseErrors.value_too_low);  
        tvm.rawReserve(math.max(
            Gas.AUCTION_ROOT_INITIAL_BALANCE, 
            address(this).balance - msg.value), 2
        );

        IUpgradableByRequest(getOfferAddress(_nft, _nonce)).upgrade{
            value: 0,
            flag: 128
        }(offerCode, currentVersionOffer, sendGasTo);      
    }

    function upgradeOfferCode(TvmCell newCode) public onlyOwner {
        tvm.rawReserve(Gas.SET_CODE, 0);
        offerCode = newCode;
        currentVersionOffer++;

        msg.sender.transfer(
            0,
            false,
            128 + 2
        );
    }

    function upgrade(
        TvmCell newCode,
        uint32 newVersion,
        address sendGasTo
    ) external onlyOwner {
        if (currentVersion == newVersion) {
            tvm.rawReserve(Gas.AUCTION_ROOT_INITIAL_BALANCE, 0);
            sendGasTo.transfer({
                value: 0,
                flag: 128 + 2,
                bounce: false
            });
		} else {
            emit AuctionRootUpgrade();

            TvmCell cellParams = abi.encode(
                nonce_,
                owner(),
                currentVersion,
                currentVersionOffer,
                auctionBidDelta,
                auctionBidDeltaDecimals,
                codeNft,
                offerCode,
                deploymentFee,
                marketFeeNumerator,
                marketFeeDenominator,
                deploymentFeePart
            );
            
            tvm.setcode(newCode);
            tvm.setCurrentCode(newCode);

            onCodeUpgrade (cellParams);
        }
    }

    function onCodeUpgrade(TvmCell data) private {}
}