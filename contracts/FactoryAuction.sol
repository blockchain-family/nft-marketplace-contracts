pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import './errors/BaseErrors.sol';
import './errors/AuctionErrors.sol';

import './libraries/Gas.sol';

import './interfaces/IAuctionRootCallback.sol';
import './interfaces/IUpgradableByRequest.sol';

import './structures/IAuctionGasValuesStructure.sol';
import './structures/IGasValueStructure.sol';
import './structures/IDiscountCollectionsStructure.sol';

import './modules/TIP4_1/interfaces/INftChangeManager.sol';
import './modules/TIP4_1/interfaces/ITIP4_1NFT.sol';
import './modules/TIP4_1/structures/ICallbackParamsStructure.sol';
import "./modules/access/OwnableInternal.sol";

import './Nft.sol';
import './Auction.sol';

import "./flow/native_token/SupportNativeTokenRoot.sol";
import "./flow/discount/DiscountCollectionRoot.sol";
import "./flow/OffersUpgradableRoot.sol";
import "./flow/fee/MarketBurnFeeRoot.sol";


contract FactoryAuction is
    INftChangeManager,
    ICallbackParamsStructure,
    IAuctionGasValuesStructure,
    SupportNativeTokenRoot,
    MarketBurnFeeRoot,
    DiscountCollectionRoot,
    OffersUpgradableRoot
{
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

    uint16 public auctionBidDelta;
    uint16 public auctionBidDeltaDecimals;

    AuctionGasValues auctionGas;

    event AuctionDeployed(address offer, MarketOffer offerInfo);
    event AuctionDeclined(address nftOwner, address nft);
    event AuctionRootUpgrade();

    constructor(
        address _owner,
        MarketFee _fee,
        uint16 _auctionBidDelta,
        uint16 _auctionBidDeltaDecimals,
        address _remainingGasTo,
        address _weverVault,
        address _weverRoot
    )
        OwnableInternal(_owner)
        public
        reserve
    {
        tvm.accept();
        _initialization(
            _fee,
            _weverRoot,
            _weverVault
        );
        currentVersion++;
        auctionBidDelta = _auctionBidDelta;
        auctionBidDeltaDecimals = _auctionBidDeltaDecimals;
        auctionGas = AuctionGasValues(
            //gasK
            valueToGas(1 ever, address(this).wid),
            // deployWallet
            GasValues(
                // fixed
                Gas.DEPLOY_EMPTY_WALLET_GRAMS +
                Gas.DEPLOY_WALLET_ROOT_COMPENSATION,
                //dynamic
                valueToGas(Gas.DEPLOY_WALLET_EXTRA_GAS, address(this).wid)
            ),
            // royalty
            GasValues(
                // fixed
                Gas.GET_INFO_VALUE +
                Gas.GET_ROYALTY_INFO_VALUE +
                Gas.GET_ROYALTY_INFO_VALUE,
                //dynamic
                valueToGas(Gas.GET_ROYALTY_INFO_EXTRA_VALUE, address(this).wid)
            ),
            // deployAuction
            GasValues(
                // fixed
                Gas.DEPLOY_EMPTY_WALLET_GRAMS +
                Gas.DEPLOY_WALLET_ROOT_COMPENSATION +
                Gas.GET_INFO_VALUE +
                Gas.GET_INFO_VALUE +
                Gas.GET_ROYALTY_INFO_VALUE +
                Gas.GET_ROYALTY_INFO_VALUE,
                //dynamic
                valueToGas(
                    Gas.DEPLOY_WALLET_EXTRA_GAS +
                    Gas.DEPLOY_AUCTION_EXTRA_GAS_VALUE +
                    Gas.GET_ROYALTY_INFO_EXTRA_VALUE,
                    address(this).wid
                )
            ),
            //sell
            GasValues(
                // fixed
                Gas.AUCTION_ROOT_INITIAL_BALANCE +
                Gas.AUCTION_INITIAL_BALANCE +
                Gas.DEPLOY_EMPTY_WALLET_GRAMS +
                Gas.DEPLOY_WALLET_ROOT_COMPENSATION +
                Gas.FRONTENT_CALLBACK_VALUE +
                Gas.GET_INFO_VALUE +
                Gas.GET_INFO_VALUE +
                Gas.GET_ROYALTY_INFO_VALUE +
                Gas.GET_ROYALTY_INFO_VALUE,
                //dynamic
                valueToGas(
                    Gas.START_AUCTION_EXTRA_GAS_VALUE +
                    Gas.DEPLOY_WALLET_EXTRA_GAS +
                    Gas.DEPLOY_AUCTION_EXTRA_GAS_VALUE +
                    Gas.GET_ROYALTY_INFO_EXTRA_VALUE,
                    address(this).wid
                )
            ),
            //bid
            GasValues(
                // fixed
                Gas.AUCTION_INITIAL_BALANCE +
                Gas.FRONTENT_CALLBACK_VALUE +
                Gas.FRONTENT_CALLBACK_VALUE +
                Gas.TOKEN_TRANSFER_VALUE,
                //dynamic
                valueToGas(Gas.BID_EXTRA_GAS_VALUE, address(this).wid)
            ),
            // cancel
            GasValues(
                // fixed
                Gas.AUCTION_INITIAL_BALANCE +
                Gas.FRONTENT_CALLBACK_VALUE +
                Gas.NFT_CALLBACK_VALUE +
                Gas.FEE_DEPLOY_WALLET_GRAMS +
                Gas.FEE_EXTRA_VALUE +
                Gas.TOKEN_TRANSFER_VALUE +
                Gas.TRANSFER_OWNERSHIP_VALUE,
                //dynamic
                valueToGas(Gas.CANCEL_AUCTION_EXTRA_GAS_VALUE, address(this).wid)
            )
        );
        _remainingGasTo.transfer({ value: 0, flag: 128, bounce: false });
    }

    function changeBidDelta(
        uint16 _auctionBidDelta,
        uint16 _auctionBidDeltaDecimals
    )
        external
        onlyOwner
    {
        auctionBidDelta = _auctionBidDelta;
        auctionBidDeltaDecimals = _auctionBidDeltaDecimals;
    }

    function onNftChangeManager(
        uint256 /*id*/,
        address nftOwner,
        address /*oldManager*/,
        address newManager,
        address collection,
        address remainingGasTo,
        TvmCell payload
    )
        external
        override
        reserve
    {
        require(newManager == address(this));
        bool isDeclined = false;
        uint32 callbackId = 0;

        TvmSlice payloadSlice = payload.toSlice();
        if (payloadSlice.bits() >= 32) {
            callbackId = payloadSlice.decode(uint32);
        }
        if (payloadSlice.bits() >= 523) {
            (
                address paymentToken,
                uint128 price,
                uint64 auctionStartTime,
                uint64 auctionDuration
            ) = payloadSlice.decode(address, uint128, uint64, uint64);
            if (
                paymentToken.value > 0 &&
                price >= 0 &&
                auctionStartTime > 0 &&
                auctionDuration > 0 &&
                msg.value >= calcValue(auctionGas.start) &&
                msg.sender.value != 0
            ) {
                optional(DiscountInfo) discountOpt;
                if (payloadSlice.refs() >= 1) {
                    TvmSlice discontSlice = payloadSlice.loadRefAsSlice();
                    if (discontSlice.bits() >= 523) {
                        address discountCollection = discontSlice.decode(address);
                        uint256 nftId = discontSlice.decode(uint256);
                        if (_isDiscountCollectionExists(discountCollection)) {
                            discountOpt.set(
                                DiscountInfo(
                                    discountCollection,
                                    nftId,
                                    _getInfoFromCollectionsSpecialRules(discountCollection)
                                )
                            );
                        }
                    }
                }
                uint64 nonce = tx.timestamp;
                address offerAddress = new Auction {
                    stateInit: _buildOfferStateInit(nftOwner, paymentToken, msg.sender, nonce, address(this)),
                    value: calcValue(auctionGas.deployAuction),
                    flag: 1
                }(
                    price,
                    collection,
                    _getMarketFee(),
                    _getMarketBurnFee(),
                    auctionStartTime,
                    auctionDuration,
                    auctionBidDelta,
                    auctionBidDeltaDecimals,
                    nftOwner,
                    _getWeverVault(),
                    _getWeverRoot(),
                    auctionGas,
                    discountOpt
                );

                MarketOffer offerInfo = MarketOffer(
                    collection,
                    nftOwner,
                    msg.sender,
                    offerAddress,
                    price,
                    auctionDuration,
                    nonce
                );

                emit AuctionDeployed(offerAddress, offerInfo);
                IAuctionRootCallback(nftOwner).auctionTip3DeployedCallback{
                     value: Gas.FRONTENT_CALLBACK_VALUE,
                     flag: 1,
                     bounce: false
                }(
                    callbackId,
                    offerAddress,
                    offerInfo
                );

                mapping(address => CallbackParams) callbacks;
                ITIP4_1NFT(msg.sender).changeManager{ value: 0, flag: 128 }(
                    offerAddress,
                    remainingGasTo,
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
                value: Gas.FRONTENT_CALLBACK_VALUE,
                flag: 1,
                bounce: false
            }(
                callbackId,
                nftOwner,
                msg.sender
            );

            mapping(address => CallbackParams) callbacks;
            ITIP4_1NFT(msg.sender).changeManager{ value: 0, flag: 128 }(
                nftOwner,
                remainingGasTo,
                callbacks
            );
        }
    }

    function getGasValue()
        external
        view
        returns (AuctionGasValues)
    {
        return auctionGas;
    }

    function getTypeContract()
        external
        pure
        returns (string)
    {
        return "AuctionRoot";
    }

    function buildAuctionCreationPayload(
        uint32 _callbackId,
        address _paymentToken,
        uint128 _price,
        uint64 _auctionStartTime,
        uint64 _auctionDuration,
        optional(address) _discountCollection,
        optional(uint256) _discountNftId
    )
        external
        pure
        responsible
        returns(TvmCell)
    {
        TvmBuilder builder;
        builder.store(_callbackId);
        builder.store(_paymentToken);
        builder.store(_price);
        builder.store(_auctionStartTime);
        builder.store(_auctionDuration);

        TvmBuilder discontBuilder;
        if (_discountCollection.hasValue()) {
            discontBuilder.store(_discountCollection.get());
        }
        if (_discountNftId.hasValue()) {
            discontBuilder.store(_discountNftId.get());
        }
        builder.storeRef(discontBuilder);
        return { value: 0, bounce: false, flag: 64 } builder.toCell();
    }

    function _getTargetBalanceInternal()
        internal
        view
        virtual
        override
        returns (uint128)
    {
        return Gas.AUCTION_ROOT_INITIAL_BALANCE;
    }

    function upgrade(
        TvmCell newCode,
        uint32 newVersion,
        address remainingGasTo
    )
        external
        onlyOwner
        reserve
    {
        if (currentVersion == newVersion) {
            remainingGasTo.transfer({
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
                _getCurrentVersionOffer(),
                auctionBidDelta,
                auctionBidDeltaDecimals,
                _getOfferCode(),
                _getMarketFee(),
                _getWeverVault(),
                _getWeverRoot(),
                auctionGas,
                _getCollectionsSpecialRules()
            );

            tvm.setcode(newCode);
            tvm.setCurrentCode(newCode);

            onCodeUpgrade (cellParams);
        }
    }

    function onCodeUpgrade(TvmCell data) private {}
}
