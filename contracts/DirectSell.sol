pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./errors/BaseErrors.sol";
import "./errors/DirectBuySellErrors.sol";

import "./libraries/Gas.sol";
import "./libraries/DirectSellStatus.sol";

import "./interfaces/IDirectSellCallback.sol";
import "./interfaces/IUpgradableByRequest.sol";

import "./structures/IDirectSellGasValuesStructure.sol";
import "./structures/IGasValueStructure.sol";

import "./modules/TIP4_1/interfaces/ITIP4_1NFT.sol";
import "./modules/TIP4_1/structures/ICallbackParamsStructure.sol";

import "./Nft.sol";

import "tip3/contracts/interfaces/ITokenRoot.sol";
import "tip3/contracts/interfaces/ITokenWallet.sol";
import "tip3/contracts/interfaces/IAcceptTokensTransferCallback.sol";

import "./flow/discount/DiscountCollectionOffer.sol";
import "./flow/fee/MarketBurnFeeOffer.sol";
import "./flow/native_token/SupportNativeTokenOffer.sol";
import "./flow/RoyaltyOffer.sol";


contract DirectSell is
    IAcceptTokensTransferCallback,
    IUpgradableByRequest,
    IDirectSellGasValuesStructure,
    ICallbackParamsStructure,
    IGasValueStructure,
    DiscountCollectionOffer,
MarketBurnFeeOffer,
    SupportNativeTokenOffer,
    RoyaltyOffer
{
    DirectSellGasValues directSellGas;

    uint64 startTime;
    uint64 durationTime;
    uint64 endTime;

    uint128 price;
    address tokenWallet;

    uint8 currentStatus;
    uint32 currentVersion;

    struct DirectSellInfo {
        address factory;
        address creator;
        address token;
        address nft;
        uint64 _timeTx;
        uint64 start;
        uint64 end;
        uint128 _price;
        address wallet;
        uint8 status;
    }

    event DirectSellStateChanged(uint8 from, uint8 to, DirectSellInfo);
    event DirectSellUpgrade();

    constructor(
        uint64 _startTime,
        uint64 _durationTime,
        uint128 _price,
        MarketFee _fee,
        optional(MarketBurnFee) _burnFee,
        address _weverVault,
        address _weverRoot,
        address _collection,
        DirectSellGasValues _directSellGas,
        optional(DiscountInfo) _discountOpt
    )
        public
        reserve
    {
        if (
            msg.sender.value != 0 &&
            msg.sender == _getMarketRootAddress() &&
            msg.sender.value >= calcValue(_directSellGas.deployDirectSell)
        ) {
            startTime = _startTime;
            durationTime = _durationTime;
            directSellGas = _directSellGas;
            if (startTime > 0 && durationTime > 0) {
                endTime = startTime + durationTime;
            }
            price = _price;
            _initialization(
                _fee,
                _burnFee,
                _weverRoot,
                _weverVault,
                _discountOpt
            );
            if (_getDiscountOpt().hasValue()) {
                _discountAvailabilityCheck();
            }
            _setCollection(_collection);
            _checkRoyaltyFromNFT(calcValue(directSellGas.royalty));
            currentVersion++;
            _changeState(DirectSellStatus.Create);

            ITokenRoot(_getPaymentToken()).deployWallet{
                value: 0,
                flag: 128,
                callback: DirectSell.onTokenWallet
            }(address(this), Gas.DEPLOY_EMPTY_WALLET_GRAMS);
        } else {
            msg.sender.transfer(0, false, 128 + 32);
        }
    }

    function onTokenWallet(
        address _wallet
    )
        external
        onlyPaymentToken
        reserve
    {
        require(msg.sender.value != 0, BaseErrors.operation_not_permited);
        tokenWallet = _wallet;
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
        if (currentStatus == DirectSellStatus.Create) {
            _fallbackRoyaltyFromCollection(functionId);
        }
        _getOwner().transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function onAcceptTokensTransfer(
        address, /*token_root*/
        uint128 amount,
        address sender,
        address, /*sender_wallet*/
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
        TvmCell emptyPayload;
        mapping(address => CallbackParams) callbacks;
        if (
            msg.sender.value != 0 &&
            msg.sender == tokenWallet &&
            msg.value >= calcValue(directSellGas.buy) &&
            currentStatus == DirectSellStatus.Active &&
            amount >= price &&
            ((endTime > 0 && now < endTime) || endTime == 0) &&
            now >= startTime
        ) {
            IDirectSellCallback(buyer).directSellSuccess{
                value: Gas.FRONTENT_CALLBACK_VALUE,
                flag: 1,
                bounce: false
            }(
                callbackId,
                _getOwner(),
                buyer,
                _getNftAddress()
            );

            uint128 currentFee = _getCurrentFee(price);
            uint128 currentRoyalty = _getCurrentRoyalty(price);
            uint128 balance = _countCorrectFinalPrice(currentFee, currentRoyalty, price);

            _changeState(DirectSellStatus.Filled);
            callbacks[buyer] = CallbackParams(Gas.NFT_CALLBACK_VALUE, emptyPayload);

            ITIP4_1NFT(_getNftAddress()).transfer{
                value: 0,
                flag: 128,
                bounce: false
            }(
                buyer,
                originalGasTo,
                callbacks
            );

            _transfer(
                _getPaymentToken(),
                balance,
                _getOwner(),
                originalGasTo,
                tokenWallet,
                Gas.TOKEN_TRANSFER_VALUE,
                1,
                Gas.DEPLOY_EMPTY_WALLET_GRAMS,
                emptyPayload
            );

            if (currentFee > 0) {
                _retentionMarketFee(
                    tokenWallet,
                    Gas.FEE_EXTRA_VALUE,
                    Gas.FEE_DEPLOY_WALLET_GRAMS,
                    currentFee,
                    originalGasTo
                );
            }

            if (currentRoyalty > 0) {
                _retentionRoyalty(currentRoyalty, tokenWallet, originalGasTo);
            }

        } else {
            if (endTime > 0 && now >= endTime && currentStatus == DirectSellStatus.Active) {
                IDirectSellCallback(buyer).directSellCancelledOnTime{
                    value: Gas.FRONTENT_CALLBACK_VALUE,
                    flag: 1,
                    bounce: false
                }(
                    callbackId,
                    _getNftAddress()
                );

                _changeState(DirectSellStatus.Expired);

                _transfer(
                    _getPaymentToken(),
                    amount,
                    buyer,
                    originalGasTo,
                    msg.sender,
                    Gas.TOKEN_TRANSFER_VALUE,
                    1,
                    uint128(0),
                    emptyPayload
                );

                callbacks[_getOwner()] = CallbackParams(Gas.NFT_CALLBACK_VALUE, emptyPayload);

                ITIP4_1NFT(_getNftAddress()).transfer{
                    value: 0,
                    flag: 128,
                    bounce: false
                }(
                    _getOwner(),
                    originalGasTo,
                    callbacks
                );
            } else {
                IDirectSellCallback(buyer).directSellNotSuccess{
                    value: Gas.FRONTENT_CALLBACK_VALUE,
                    flag: 1,
                    bounce: false
                }(
                    callbackId,
                    _getNftAddress()
                );
                _transfer(
                    _getPaymentToken(),
                    amount,
                    buyer,
                    originalGasTo,
                    msg.sender,
                    0,
                    128,
                    uint128(0),
                    emptyPayload
                );
            }
        }
    }

    function closeSell(
        uint32 _callbackId
    )
        external
        onlyOwner
        reserve
    {
        require(currentStatus == DirectSellStatus.Active,DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS);
        require(msg.value >= calcValue(directSellGas.cancel), BaseErrors.not_enough_value);

        IDirectSellCallback(_getOwner()).directSellClose{
            value: Gas.FRONTENT_CALLBACK_VALUE,
            flag: 1,
            bounce: false
        }(
            _callbackId,
            _getNftAddress()
        );
        _changeState(DirectSellStatus.Cancelled);

        mapping(address => CallbackParams) callbacks;
        TvmCell emptyPayload;
        callbacks[_getOwner()] = CallbackParams(Gas.NFT_CALLBACK_VALUE, emptyPayload);

        ITIP4_1NFT(_getNftAddress()).transfer{
            value: 0,
            flag: 128,
            bounce: false
        }(
            _getOwner(),
            _getOwner(),
            callbacks
        );
    }

    function getInfo()
        external
        view
        returns (DirectSellInfo)
    {
        return _buildInfo();
    }

    function getTypeContract()
        external
        pure
        returns (string)
    {
        return "DirectSell";
    }

    function buildBuyPayload(
        uint32 _callbackId,
        address _buyer
    )
        external
        pure
        returns (TvmCell)
    {
        TvmBuilder builder;
        builder.store(_callbackId);
        builder.store(_buyer);
        return builder.toCell();
    }

    function finishSell(
        address _remainingGasTo,
        uint32 _callbackId
    )
        public
        reserve
    {
        require(currentStatus == DirectSellStatus.Active, DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS);
        require(now >= endTime, DirectBuySellErrors.DIRECT_BUY_SELL_IN_STILL_PROGRESS);
        require(msg.value >= calcValue(directSellGas.cancel), BaseErrors.not_enough_value);

        IDirectSellCallback(msg.sender).directSellCancelledOnTime{
            value: Gas.FRONTENT_CALLBACK_VALUE,
            flag: 1,
            bounce: false
        }(
            _callbackId,
            _getNftAddress()
        );
        _changeState(DirectSellStatus.Expired);

        mapping(address => CallbackParams) callbacks;

        TvmCell emptyPayload;
        callbacks[_getOwner()] = CallbackParams(Gas.NFT_CALLBACK_VALUE, emptyPayload);

        ITIP4_1NFT(_getNftAddress()).transfer{
            value: 0,
            flag: 128,
            bounce: false
        }(
            _getOwner(),
            _remainingGasTo,
            callbacks
        );
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
            currentStatus == DirectSellStatus.Create
        ) {
            _changeState(DirectSellStatus.Active);
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
        return (currentStatus == DirectSellStatus.Create);
    }

    function _getTargetBalanceInternal()
        internal
        view
        virtual
        override
        returns (uint128)
    {
        return Gas.DIRECT_SELL_INITIAL_BALANCE;
    }


    function _changeState(
        uint8 _newState
    )
        private
    {
        uint8 prevStateN = currentStatus;
        currentStatus = _newState;
        emit DirectSellStateChanged(prevStateN, _newState, _buildInfo());
    }

    function _buildInfo()
        private
        view
        returns (DirectSellInfo)
    {
        return DirectSellInfo({
            factory: _getMarketRootAddress(),
            creator: _getOwner(),
            token: _getPaymentToken(),
            nft: _getNftAddress(),
            _timeTx: _getNonce(),
            start: startTime,
            end: endTime,
            _price: price,
            wallet: tokenWallet,
            status: currentStatus
        });
    }

    function onAcceptTokensBurn(
        uint128 amount,
        address /*walletOwner*/,
        address /*wallet*/,
        address user,
        TvmCell payload
    )
         external
         virtual
         reserve
    {
        optional(MarketBurnFee) burnFee = _getMarketBurnFee();
        require(msg.sender.value != 0 && (msg.sender == _getWeverRoot() || msg.sender == _getPaymentToken()), BaseErrors.not_wever_root_or_payment_token);
        if (burnFee.hasValue() && msg.sender == _getPaymentToken()) {
            _tokensBurn();
        } else {
            _weverBurn(amount, user, payload);
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
        require(msg.sender.value != 0, BaseErrors.operation_not_permited);
        if (currentVersion == newVersion) {
            remainingGasTo.transfer({
                value: 0,
                flag: 128 + 2,
                bounce: false
            });
        } else {
            emit DirectSellUpgrade();

            TvmCell cellParams = abi.encode(
                _getMarketRootAddress(),
                _getOwner(),
                _getPaymentToken(),
                _getNftAddress(),
                _getNonce(),
                _getCollection(),
                startTime,
                durationTime,
                endTime,
                price,
                tokenWallet,
                currentStatus,
                currentVersion,
                _getMarketFee(),
                _getWeverVault(),
                _getWeverRoot(),
                directSellGas,
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
