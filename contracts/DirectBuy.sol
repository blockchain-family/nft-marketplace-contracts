pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./errors/BaseErrors.sol";
import "./errors/DirectBuySellErrors.sol";

import "./libraries/Gas.sol";
import "./libraries/DirectBuyStatus.sol";

import "./interfaces/IDirectBuyCallback.sol";
import "./interfaces/IUpgradableByRequest.sol";

import "./modules/TIP4_1/interfaces/INftChangeManager.sol";
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

import "./structures/IDirectBuyGasValuesStructure.sol";

contract DirectBuy is
    IAcceptTokensTransferCallback,
    INftChangeManager,
    IUpgradableByRequest,
    ICallbackParamsStructure,
    IDirectBuyGasValuesStructure,
    DiscountCollectionOffer,
    MarketBurnFeeOffer,
    SupportNativeTokenOffer,
    RoyaltyOffer
{
    uint128 price;
    bool tokensReceived = false;

    uint64 startTime;
    uint64 durationTime;
    uint64 endTime;

    address tokenWallet;
    uint8 currentStatus;
    uint32 currentVersion;

    DirectBuyGasValues directBuyGas;

    struct DirectBuyInfo {
        address factory;
        address creator;
        address spentToken;
        address nft;
        uint64 _timeTx;
        uint128 _price;
        address spentWallet;
        uint8 status;
        uint64 startTimeBuy;
        uint64 durationTimeBuy;
        uint64 endTimeBuy;
    }

    event DirectBuyStateChanged(uint8 from, uint8 to, DirectBuyInfo);
    event DirectBuyUpgrade();

    mapping(address => uint128) internal tmp_transactions;

    constructor(
        uint128 _amount,
        uint64 _startTime,
        uint64 _durationTime,
        MarketFee _fee,
        address _weverVault,
        address _weverRoot,
        DirectBuyGasValues _directBuyGas,
        optional(DiscountInfo) _discountOpt
    )
        public
        reserve
    {
        if (msg.sender.value != 0 && msg.sender == _getMarketRootAddress()) {

            price = _amount;
            startTime = _startTime;
            durationTime = _durationTime;

            if (_startTime > 0 && _durationTime > 0) {
                endTime = _startTime + _durationTime;
            }

            directBuyGas = _directBuyGas;

            _initialization(
                _fee,
                _weverRoot,
                _weverVault,
                _discountOpt
            );

            _checkRoyaltyFromNFT(calcValue(directBuyGas.royalty));

            if (_getDiscountOpt().hasValue()) {
                _discountAvailabilityCheck();
            }
            currentVersion++;
            changeState(DirectBuyStatus.Create);

            ITokenRoot(_getPaymentToken()).deployWallet{
                value: 0,
                flag: 128,
                callback: DirectBuy.onTokenWallet
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
        tokenWallet = _wallet;
        if (
            tmp_transactions.exists(tokenWallet) &&
            tmp_transactions[tokenWallet] >= price
        ) {
            tokensReceived = true;
            tmp_transactions.delMin();
            _checkAndActivate();
        }
        _getOwner().transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    onBounce(
        TvmSlice _body
    )
        external
        reserve
    {
        uint32 functionId = _body.decode(uint32);
        if (currentStatus == DirectBuyStatus.Create) {
            _fallbackRoyaltyFromCollection(functionId);
        }
        _getOwner().transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function onAcceptTokensTransfer(
        address tokenRoot,
        uint128 amount,
        address sender,
        address, /*senderWallet*/
        address originalGasTo,
        TvmCell /*payload*/
    )
        external
        override
        reserve
    {
        require(msg.sender.value != 0, BaseErrors.operation_not_permited);
        if (
            tokenRoot == _getPaymentToken() &&
            sender == _getMarketRootAddress() &&
            amount >= price
        ) {
            if (
                tokenWallet.value == 0 &&
                currentStatus == DirectBuyStatus.Create
            ){
                tmp_transactions[msg.sender] += amount;
            } else if (
                msg.sender == tokenWallet
            ){
                tokensReceived = true;
                _checkAndActivate();
            }
            _getOwner().transfer({ value: 0, flag: 128 + 2, bounce: false });
        } else {
            TvmCell emptyPayload;
            ITokenWallet(msg.sender).transfer{
                value: 0,
                flag: 128,
                bounce: false
            }(
                amount,
                sender,
                uint128(0),
                originalGasTo,
                true,
                emptyPayload
            );
        }
    }

    function onNftChangeManager(
        uint256, /*id*/
        address nftOwner,
        address, /*oldManager*/
        address newManager,
        address, /*collection*/
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
        TvmCell emptyPayload;

        if (
            msg.sender.value != 0 &&
            msg.sender == _getNftAddress() &&
            msg.sender.value >= calcValue(directBuyGas.accept) &&
            currentStatus == DirectBuyStatus.Active &&
            ((endTime > 0 && now < endTime) || endTime == 0) &&
            now >= startTime
        ) {
            uint128 currentFee = _getCurrentFee(price);
            uint128 currentRoyalty = _getCurrentRoyalty(price);
            uint128 balance = _countCorrectFinalPrice(currentFee, currentRoyalty, price);

            IDirectBuyCallback(nftOwner).directBuySuccess{
                value: Gas.FRONTENT_CALLBACK_VALUE,
                flag: 1,
                bounce: false
            }(
                callbackId,
                nftOwner,
                _getOwner(),
                _getNftAddress()
            );

            changeState(DirectBuyStatus.Filled);
            callbacks[_getOwner()] = CallbackParams(Gas.NFT_CALLBACK_VALUE, emptyPayload);

            ITIP4_1NFT(_getNftAddress()).transfer{
                value: 0,
                flag: 128,
                bounce: false
            }(
                _getOwner(),
                remainingGasTo,
                callbacks
            );

            _transfer(
                _getPaymentToken(),
                balance,
                nftOwner,
                remainingGasTo,
                tokenWallet,
                Gas.TOKEN_TRANSFER_VALUE,
                1,
                Gas.DEPLOY_EMPTY_WALLET_GRAMS,
                emptyPayload
            );

            if (currentFee > 0) {
                _retentionMarketFee(tokenWallet, Gas.FEE_EXTRA_VALUE, uint128(0), currentFee, remainingGasTo);
            }

            if (currentRoyalty > 0) {
                _retentionRoyalty(currentRoyalty, tokenWallet, remainingGasTo);
            }
        } else {
            if (endTime > 0 && now >= endTime && currentStatus == DirectBuyStatus.Active) {
                IDirectBuyCallback(nftOwner).directBuyCancelledOnTime{
                    value: Gas.FRONTENT_CALLBACK_VALUE,
                    flag: 1,
                    bounce: false
                }(
                    callbackId,
                    _getNftAddress()
                );

                changeState(DirectBuyStatus.Expired);

                ITIP4_1NFT(msg.sender).changeManager{
                  value: 0,
                  flag: 128
                }(
                  nftOwner,
                  remainingGasTo,
                  callbacks
                );

                _transfer(
                    _getPaymentToken(),
                    price,
                    _getOwner(),
                    remainingGasTo,
                    tokenWallet,
                    Gas.TOKEN_TRANSFER_VALUE,
                    1,
                    uint128(0),
                    emptyPayload
                );
            } else {
                IDirectBuyCallback(nftOwner).directBuyNotSuccess{
                    value: Gas.FRONTENT_CALLBACK_VALUE,
                    flag: 1,
                    bounce: false
                }(
                    callbackId,
                    _getNftAddress()
                );

                ITIP4_1NFT(msg.sender).changeManager{
                    value: 0,
                    flag: 128
                }(
                    nftOwner,
                    remainingGasTo,
                    callbacks
                );
            }
        }
    }

    function getInfo()
        external
        view
        returns (DirectBuyInfo)
    {
        return _buildInfo();
    }

    function getTypeContract()
        external
        pure
        returns (string)
    {
        return "DirectBuy";
    }

    function _checkAndActivate()
        internal
        virtual
        override
    {
        if (
            _getRoyalty().hasValue() &&
            tokensReceived &&
            currentStatus == DirectBuyStatus.Create
        ) {
            changeState(DirectBuyStatus.Active);
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
        return (currentStatus == DirectBuyStatus.Create);
    }

    function _getTargetBalanceInternal()
        internal
        view
        virtual
        override
        returns (uint128)
    {
        return Gas.DIRECT_BUY_INITIAL_BALANCE;
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

    function changeState(
        uint8 _newState
    )
        private
    {
        uint8 prevStateN = currentStatus;
        currentStatus = _newState;
        emit DirectBuyStateChanged(prevStateN, _newState, _buildInfo());
    }

    function _buildInfo()
        private
        view
        returns (DirectBuyInfo)
    {
        return DirectBuyInfo({
            factory: _getMarketRootAddress(),
            creator: _getOwner(),
            spentToken: _getPaymentToken(),
            nft:_getNftAddress(),
            _timeTx: _getNonce(),
            _price: price,
            spentWallet: tokenWallet,
            status: currentStatus,
            startTimeBuy: startTime,
            durationTimeBuy: durationTime,
            endTimeBuy: endTime
        });
    }

    function finishBuy(
        address _remainingGasTo,
        uint32 _callbackId
    )
        public
        reserve
    {
        require(
          currentStatus == DirectBuyStatus.Active,
          DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS
        );
        require(now >= endTime, DirectBuySellErrors.DIRECT_BUY_SELL_IN_STILL_PROGRESS);
        require(msg.value >= calcValue(directBuyGas.cancel), BaseErrors.not_enough_value);

        IDirectBuyCallback(msg.sender).directBuyCancelledOnTime{
          value: Gas.FRONTENT_CALLBACK_VALUE,
          flag: 1,
          bounce: false
        }(
          _callbackId,
          _getNftAddress()
        );

        changeState(DirectBuyStatus.Expired);

        TvmCell emptyPayload;
        _transfer(
            _getPaymentToken(),
            price,
            _getOwner(),
            _remainingGasTo,
            tokenWallet,
            0,
            128,
            uint128(0),
            emptyPayload
        );
    }

    function closeBuy(
        uint32 _callbackId
    )
        external
        onlyOwner
        reserve
    {
        require(
            currentStatus == DirectBuyStatus.Active,
            DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS
        );
        IDirectBuyCallback(_getOwner()).directBuyClose{
            value: Gas.FRONTENT_CALLBACK_VALUE,
            flag: 1,
            bounce: false
        }(
            _callbackId,
            _getNftAddress()
        );
        changeState(DirectBuyStatus.Cancelled);

        TvmCell emptyPayload;
        _transfer(
            _getPaymentToken(),
            price,
            _getOwner(),
            _getOwner(),
            tokenWallet,
            0,
            128,
            uint128(0),
            emptyPayload
        );
    }

    function upgrade(
        TvmCell newCode,
        uint32 newVersion,
        address remainingGasTo
    )
        external
        override
        reserve
    {
        require(
            msg.sender.value != 0 &&
            msg.sender == _getMarketRootAddress(),
            DirectBuySellErrors.NOT_FACTORY_DIRECT_BUY
        );

        if (currentVersion == newVersion) {
            remainingGasTo.transfer({
                value: 0,
                flag: 128 + 2,
                bounce: false
            });
        } else {
            emit DirectBuyUpgrade();

            TvmCell cellParams = abi.encode(
                _getMarketRootAddress(),
                _getOwner(),
                _getPaymentToken(),
                _getNftAddress(),
                _getNonce(),
                price,
                startTime,
                durationTime,
                endTime,
                tokenWallet,
                currentStatus,
                currentVersion,
                _getMarketFee(),
                _getWeverVault(),
                _getWeverRoot(),
                directBuyGas,
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
