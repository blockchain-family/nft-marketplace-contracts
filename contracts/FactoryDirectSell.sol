pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./errors/BaseErrors.sol";
import "./errors/DirectBuySellErrors.sol";

import "./libraries/Gas.sol";

import "./interfaces/IDirectSellCallback.sol";
import "./interfaces/IUpgradableByRequest.sol";

import "./structures/IDirectSellGasValuesStructure.sol";
import "./structures/IGasValueStructure.sol";

import "./modules/access/OwnableInternal.sol";
import "./modules/TIP4_1/interfaces/INftChangeManager.sol";
import "./modules/TIP4_1/interfaces/ITIP4_1NFT.sol";
import "./modules/TIP4_1/structures/ICallbackParamsStructure.sol";

import "./Nft.sol";
import "./DirectSell.sol";

import "./flow/fee/MarketBurnFeeRoot.sol";
import "./flow/native_token/SupportNativeTokenRoot.sol";
import "./flow/discount/DiscountCollectionRoot.sol";
import "./flow/OffersUpgradableRoot.sol";

contract FactoryDirectSell is
    INftChangeManager,
    ICallbackParamsStructure,
    MarketBurnFeeRoot,
    SupportNativeTokenRoot,
    DiscountCollectionRoot,
    OffersUpgradableRoot,
    IDirectSellGasValuesStructure
{
    uint64 static nonce_;

    uint32 currentVersion;
    DirectSellGasValues directSellGas;

    event DirectSellDeployed(
        address directSell,
        address sender,
        address paymentToken,
        address nft,
        uint64  nonce,
        uint128 price
    );
    event DirectSellDeclined(address sender, address nft);
    event FactoryDirectSellUpgrade();

    constructor(
        address _owner,
        address _remainingGasTo,
        MarketFee _fee,
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

        directSellGas = DirectSellGasValues(
            //gasK
            valueToGas(1 ever, address(this).wid),
            // deploy wallet
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
            // deploy direct sell
            GasValues(
                // fixed
                Gas.DIRECT_SELL_INITIAL_BALANCE +
                Gas.TOKEN_BURN_VALUE +
                Gas.DEPLOY_EMPTY_WALLET_GRAMS +
                Gas.DEPLOY_WALLET_ROOT_COMPENSATION +
                Gas.GET_INFO_VALUE +
                Gas.GET_INFO_VALUE +
                Gas.GET_ROYALTY_INFO_VALUE +
                Gas.GET_ROYALTY_INFO_VALUE,
                //dynamic
                valueToGas(
                    Gas.DEPLOY_WALLET_EXTRA_GAS +
                    Gas.DEPLOY_DIRECT_SELL_EXTRA_GAS_VALUE +
                    Gas.GET_ROYALTY_INFO_EXTRA_VALUE,
                    address(this).wid
                )
            ),
            //sell
            GasValues(
                // fixed
                Gas.FACTORY_DIRECT_SELL_INITIAL_BALANCE +
                Gas.DIRECT_SELL_INITIAL_BALANCE +
                Gas.TOKEN_BURN_VALUE +
                Gas.DEPLOY_EMPTY_WALLET_GRAMS +
                Gas.DEPLOY_WALLET_ROOT_COMPENSATION +
                Gas.FRONTENT_CALLBACK_VALUE +
                Gas.GET_INFO_VALUE +
                Gas.GET_INFO_VALUE +
                Gas.GET_ROYALTY_INFO_VALUE +
                Gas.GET_ROYALTY_INFO_EXTRA_VALUE,
                //dynamic
                valueToGas(
                    Gas.SELL_EXTRA_GAS_VALUE +
                    Gas.DEPLOY_WALLET_EXTRA_GAS +
                    Gas.DEPLOY_DIRECT_SELL_EXTRA_GAS_VALUE +
                    Gas.GET_ROYALTY_INFO_EXTRA_VALUE,
                    address(this).wid
                )
            ),
            //buy
            GasValues(
                // fixed
                Gas.DIRECT_SELL_INITIAL_BALANCE +
                Gas.FRONTENT_CALLBACK_VALUE +
                Gas.NFT_CALLBACK_VALUE +
                Gas.TOKEN_BURN_VALUE +
                Gas.FEE_DEPLOY_WALLET_GRAMS +
                Gas.FEE_EXTRA_VALUE +
                Gas.TOKEN_TRANSFER_VALUE +
                Gas.TRANSFER_OWNERSHIP_VALUE,
                //dynamic
                valueToGas(Gas.BUY_EXTRA_GAS_VALUE, address(this).wid)
            ),
            // cancel
            GasValues(
                // fixed
                Gas.DIRECT_SELL_INITIAL_BALANCE +
                Gas.FRONTENT_CALLBACK_VALUE +
                Gas.NFT_CALLBACK_VALUE +
                Gas.TRANSFER_OWNERSHIP_VALUE,
                //dynamic
                valueToGas(Gas.CANCEL_EXTRA_GAS_VALUE, address(this).wid)
            )
        );
        _remainingGasTo.transfer({ value: 0, flag: 128, bounce: false });
    }

    function onNftChangeManager(
        uint256, /*id*/
        address nftOwner,
        address, /*oldManager*/
        address newManager,
        address collection,
        address remainingGasTo,
        TvmCell payload
    )
        external
        override
        reserve
    {
        require(newManager == address(this), DirectBuySellErrors.NOT_NFT_MANAGER);

        uint32 callbackId = 0;
        TvmSlice payloadSlice = payload.toSlice();
        if (payloadSlice.bits() >= 32) {
            callbackId = payloadSlice.decode(uint32);
        }
        mapping(address => CallbackParams) callbacks;
        if (
            msg.sender.value != 0 &&
            msg.value >= calcValue(directSellGas.sell) &&
            payloadSlice.bits() >= 523
        ) {
            (
                uint64 startTime,
                uint64 durationTime,
                address paymentToken,
                uint128 price
            ) = payloadSlice.decode(
                uint64,
                uint64,
                address,
                uint128
            );
            if (payloadSlice.bits() >= 267) {
                nftOwner = payloadSlice.decode(address);
            }

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
            address directSell = new DirectSell{
                stateInit: _buildOfferStateInit(nftOwner, paymentToken, msg.sender, nonce, address(this)),
                value: calcValue(directSellGas.deployDirectSell),
                flag: 1
            }(
                startTime,
                durationTime,
                price,
                _getMarketFee(),
                _getMarketBurnFee(),
                _getWeverVault(),
                _getWeverRoot(),
                collection,
                directSellGas,
                discountOpt
            );

            emit DirectSellDeployed(
                directSell,
                msg.sender,
                paymentToken,
                msg.sender,
                nonce,
                price
            );

            IDirectSellCallback(nftOwner).directSellDeployed{
                value: Gas.FRONTENT_CALLBACK_VALUE,
                flag: 1,
                bounce: false
            }(
                callbackId,
                directSell,
                msg.sender,
                paymentToken,
                msg.sender,
                nonce,
                price
            );

            ITIP4_1NFT(msg.sender).changeManager{
                value: 0,
                flag: 128
            }(
                directSell,
                remainingGasTo,
                callbacks
            );
        } else {
            emit DirectSellDeclined(msg.sender, msg.sender);
                IDirectSellCallback(nftOwner).directSellDeclined{
                value: Gas.FRONTENT_CALLBACK_VALUE,
                flag: 1,
                bounce: false
            }(
                callbackId,
                msg.sender,
                msg.sender
            );

            TvmCell emptyPayload;
            callbacks[nftOwner] = CallbackParams(Gas.NFT_CALLBACK_VALUE, emptyPayload);

            ITIP4_1NFT(msg.sender).transfer{
                value: 0,
                flag: 128,
                bounce: false
            }(
                nftOwner,
                remainingGasTo,
                callbacks
            );
        }
    }

    function getGasValue()
        external
        view
        returns (DirectSellGasValues)
    {
        return directSellGas;
    }

    function getTypeContract()
        external
        pure
        returns (string)
    {
        return "FactoryDirectSell";
    }

    function buildDirectSellCreationPayload(
        uint32 _callbackId,
        uint64 _startTime,
        uint64 _durationTime,
        address _paymentToken,
        uint128 _price,
        address _recipient,
        optional(address) _discountCollection,
        optional(uint256) _discountNftId
    )
        external
        pure
        returns (TvmCell)
    {
        TvmBuilder builder;
        builder.store(_callbackId);
        builder.store(_startTime);
        builder.store(_durationTime);
        builder.store(_paymentToken);
        builder.store(_price);
        builder.store(_recipient);

        TvmBuilder discontBuilder;
        if (_discountCollection.hasValue()) {
            discontBuilder.store(_discountCollection.get());
        }
        if (_discountNftId.hasValue()) {
            discontBuilder.store(_discountNftId.get());
        }
        builder.storeRef(discontBuilder);
        return builder.toCell();
    }

    function _getTargetBalanceInternal()
        internal
        view
        virtual
        override
        returns (uint128)
    {
        return Gas.FACTORY_DIRECT_SELL_INITIAL_BALANCE;
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
            emit FactoryDirectSellUpgrade();
            TvmCell cellParams = abi.encode(
                nonce_,
                owner(),
                currentVersion,
                _getCurrentVersionOffer(),
                _getOfferCode(),
                _getMarketFee(),
                _getWeverVault(),
                _getWeverRoot(),
                directSellGas,
                _getCollectionsSpecialRules()
            );

            tvm.setcode(newCode);
            tvm.setCurrentCode(newCode);

            onCodeUpgrade(cellParams);
        }
    }

    function onCodeUpgrade(TvmCell data) private {}
}
