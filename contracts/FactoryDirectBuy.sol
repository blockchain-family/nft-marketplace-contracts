pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./errors/BaseErrors.sol";

import "./libraries/Gas.sol";

import "./interfaces/IDirectBuyCallback.sol";
import "./interfaces/IUpgradableByRequest.sol";

import "./structures/IGasValueStructure.sol";
import "./structures/IDirectBuyGasValuesStructure.sol";
import './structures/IDiscountCollectionsStructure.sol';

import "./DirectBuy.sol";

import "tip3/contracts/interfaces/ITokenWallet.sol";
import "tip3/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "tip3/contracts/TokenWalletPlatform.sol";
import "./modules/access/OwnableInternal.sol";

import "./flow/fee/MarketFeeRoot.sol";
import "./flow/discount/DiscountCollectionRoot.sol";
import "./flow/OffersUpgradableRoot.sol";
import "./flow/native_token/SupportNativeTokenFDB.sol";

contract FactoryDirectBuy is
    BaseRoot,
    IAcceptTokensTransferCallback,
    SupportNativeTokenFDB,
    MarketFeeRoot,
    DiscountCollectionRoot,
    OffersUpgradableRoot,
    IDirectBuyGasValuesStructure
{
    uint64 static nonce_;

    uint32 currentVersion;

    DirectBuyGasValues directBuyGas;

    event DirectBuyDeployed(
        address directBuy,
        address sender,
        address token,
        address nft,
        uint64 nonce,
        uint128 amount
    );
    event DirectBuyDeclined(
        address sender,
        address token,
        uint128 amount,
        address nft
    );
    event FactoryDirectBuyUpgrade();

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
        directBuyGas = DirectBuyGasValues(
            //gasK
            valueToGas(1 ever, address(this).wid),
            // deploy token wallet
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
            // deploy direct buy
            GasValues(
                // fixed
                Gas.DIRECT_BUY_INITIAL_BALANCE +
                Gas.DEPLOY_EMPTY_WALLET_GRAMS +
                Gas.DEPLOY_WALLET_ROOT_COMPENSATION +
                Gas.GET_INFO_VALUE +
                Gas.GET_INFO_VALUE +
                Gas.GET_ROYALTY_INFO_VALUE +
                Gas.GET_ROYALTY_INFO_VALUE,
                //dynamic
                valueToGas(
                    Gas.DEPLOY_DIRECT_BUY_EXTRA_VALUE +
                    Gas.DEPLOY_WALLET_EXTRA_GAS +
                    Gas.GET_ROYALTY_INFO_EXTRA_VALUE,
                    address(this).wid
                )
            ),
            //make
            GasValues(
                // fixed
                Gas.FACTORY_DIRECT_BUY_INITIAL_BALANCE +
                Gas.DIRECT_BUY_INITIAL_BALANCE +
                Gas.DEPLOY_EMPTY_WALLET_GRAMS +
                Gas.DEPLOY_WALLET_ROOT_COMPENSATION +
                Gas.FRONTENT_CALLBACK_VALUE +
                Gas.GET_INFO_VALUE +
                Gas.GET_INFO_VALUE +
                Gas.GET_ROYALTY_INFO_VALUE +
                Gas.GET_ROYALTY_INFO_VALUE,
                //dynamic
                valueToGas(
                    Gas.MAKE_OFFER_EXTRA_GAS_VALUE +
                    Gas.DEPLOY_WALLET_EXTRA_GAS +
                    Gas.DEPLOY_DIRECT_BUY_EXTRA_VALUE +
                    Gas.GET_ROYALTY_INFO_EXTRA_VALUE,
                    address(this).wid
                )
            ),
            //accept
            GasValues(
                // fixed
                Gas.DIRECT_BUY_INITIAL_BALANCE +
                Gas.FRONTENT_CALLBACK_VALUE +
                Gas.NFT_CALLBACK_VALUE +
                Gas.TRANSFER_OWNERSHIP_VALUE +
                Gas.FEE_EXTRA_VALUE +
                Gas.TOKEN_TRANSFER_VALUE,
                //dynamic
                valueToGas(Gas.ACCEPT_OFFER_EXTRA_GAS_VALUE, address(this).wid)
            ),
            // cancel
            GasValues(
                // fixed
                Gas.DIRECT_BUY_INITIAL_BALANCE +
                Gas.FRONTENT_CALLBACK_VALUE +
                Gas.TOKEN_TRANSFER_VALUE,
                //dynamic
                valueToGas(Gas.CANCEL_OFFER_EXTRA_GAS_VALUE, address(this).wid)
            )
        );
        _remainingGasTo.transfer({ value: 0, flag: 128, bounce: false });

    }

    function onAcceptTokensTransfer(
        address tokenRoot,
        uint128 amount,
        address sender,
        address, /*senderWallet*/
        address originalGasTo,
        TvmCell payload
    )
        external
        override
        reserve
    {
        uint32 callbackId = 0;
        address buyer = sender;
        address nftForBuy;
        TvmSlice payloadSlice = payload.toSlice();
        if (payloadSlice.bits() >= 32) {
            callbackId = payloadSlice.decode(uint32);
        }
        if (payloadSlice.bits() >= 267) {
            buyer = payloadSlice.decode(address);
        }
        if (payloadSlice.bits() >= 267) {
            nftForBuy = payloadSlice.decode(address);
        }
        if (
            payloadSlice.bits() >= 128 &&
            msg.sender.value != 0 &&
            msg.value >= calcValue(directBuyGas.make)
        ) {
            (uint64 startTime, uint64 durationTime) = payloadSlice.decode(uint64, uint64);

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
            address directBuyAddress = _expectedOfferAddress(buyer, tokenRoot, nftForBuy, nonce, address(this));
            new DirectBuy {
                stateInit: _buildOfferStateInit(buyer, tokenRoot, nftForBuy, nonce, address(this)),
                value: calcValue(directBuyGas.deployDirectBuy),
                flag: 1
            }(
                amount,
                startTime,
                durationTime,
                _getMarketFee(),
                _getWeverVault(),
                _getWeverRoot(),
                directBuyGas,
                discountOpt
            );

            emit DirectBuyDeployed(directBuyAddress, buyer, tokenRoot, nftForBuy, nonce, amount);
                IDirectBuyCallback(buyer).directBuyDeployed{
                value: Gas.FRONTENT_CALLBACK_VALUE,
                flag: 1,
                bounce: false
            }(
                callbackId,
                directBuyAddress,
                buyer,
                tokenRoot,
                nftForBuy,
                nonce,
                amount
            );

            ITokenWallet(msg.sender).transfer{
                value: 0,
                flag: 128,
                bounce: false
            }(
                amount,
                directBuyAddress,
                Gas.DEPLOY_EMPTY_WALLET_GRAMS,
                originalGasTo,
                true,
                payload
            );
        } else {
            emit DirectBuyDeclined(buyer, tokenRoot, amount, nftForBuy);
                IDirectBuyCallback(buyer).directBuyDeployedDeclined{
                value: Gas.FRONTENT_CALLBACK_VALUE,
                flag: 1,
                bounce: false
            }(
                callbackId,
                buyer,
                tokenRoot,
                amount,
                nftForBuy
            );

            TvmCell emptyPayload;
            _transfer(tokenRoot, amount, buyer, originalGasTo, msg.sender, 0, 128, uint128(0), emptyPayload);
        }
    }

    function getGasValue()
        external
        view
        returns (DirectBuyGasValues)
    {
        return directBuyGas;
    }

    function getTypeContract()
        external
        pure
        returns (string)
    {
        return "FactoryDirectBuy";
    }

    function buildDirectBuyCreationPayload(
        uint32 callbackId,
        address buyer,
        address nft,
        uint64 startTime,
        uint64 durationTime,
        optional(address) discountCollection,
        optional(uint256) discountNftId
    )
        external
        pure
        returns (TvmCell)
    {
        TvmBuilder builder;
        builder.store(callbackId);
        builder.store(buyer);
        builder.store(nft);
        builder.store(startTime);
        builder.store(durationTime);

        TvmBuilder discontBuilder;
        if (discountCollection.hasValue()) {
            discontBuilder.store(discountCollection.get());
        }
        if (discountNftId.hasValue()) {
            discontBuilder.store(discountNftId.get());
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
        return Gas.FACTORY_DIRECT_BUY_INITIAL_BALANCE;
    }

    function upgrade (
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
            emit FactoryDirectBuyUpgrade();

            TvmCell cellParams = abi.encode(
                nonce_,
                owner(),
                currentVersion,
                _getCurrentVersionOffer(),
                _getOfferCode(),
                _getMarketFee(),
                _getWeverVault(),
                _getWeverRoot(),
                directBuyGas,
                _getCollectionsSpecialRules()
            );
            
            tvm.setcode(newCode);
            tvm.setCurrentCode(newCode);

            onCodeUpgrade(cellParams);
        }
    }

    function onCodeUpgrade(TvmCell data) private {}
}

