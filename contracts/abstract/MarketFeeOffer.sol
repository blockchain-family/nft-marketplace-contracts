pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "../interfaces/IEventsMarketFeeOffer.sol";
import '../errors/BaseErrors.sol';

abstract contract MerketFeeOffer is IEventsMarketFeeOffer {
    MarketFee private fee;

    constructor(MarketFee _fee) {
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        _setMarketFee(_fee);
    }

    function _setMarketFee(MarketFee _fee) internal virtual {
        fee = _fee;
        emit MarketFeeChanged(address(this), fee);
    }

    function _getMarketFee() internal view virtual returns (MarketFee) {
        return fee;
    }

    modifier onlyMarketRoot() {
        require(
            msg.sender.value != 0 &&
            msg.sender == _getMarketRootAddress(),
            BaseErrors.message_sender_is_not_my_root
        );
        _;
    }

    function getMarketFee() external view override {
        _getMarketFee();
    }

    function setMarketFee(MarketFee _fee, address remainingGasTo) external override onlyMarketRoot {
        _reserve();
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        _setMarketFee(_fee);
        remainingGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function _retentionMarketFee(
        address tokenWallet,
        uint128 extraGasValue,
        uint128 deployWalletGrams,
        uint128 feeAmount,
        address paymentToken,
        address remainingGasTo
    ) internal view {
        TvmCell emptyPayload;
        emit MarketFeeWithheld(currentFee, paymentToken);
        ITokenWallet(tokenWallet).transfer{
            value: deployWalletGrams + extraGasValue,
            flag: 0,
            bounce: false
        }(
            feeAmount,
            _getMarketRootAddress(),
            deployWalletGrams,
            remainingGasTo,
            false,
            emptyPayload
        );
    }
}