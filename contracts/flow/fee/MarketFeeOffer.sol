pragma ever-solidity >= 0.61.2;


import '../../errors/BaseErrors.sol';

import "../../abstract/BaseOffer.sol";

import "tip3/contracts/interfaces/ITokenWallet.sol";

abstract contract MarketFeeOffer is BaseOffer {

    function marketFee() external view returns (MarketFee){
        return _getMarketFee();
    }

    function setMarketFee(MarketFee _fee, address _remainingGasTo) external onlyMarketRoot reserve {
        _setMarketFee(_fee);
        _remainingGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function _getCurrentFee(uint128 _price) internal returns (uint128) {
        MarketFee fee = _getMarketFee();
        return math.muldivc(_price, fee.numerator, fee.denominator);
    }

    function _retentionMarketFee(
        address _tokenWallet,
        uint128 _extraGasValue,
        uint128 _deployWalletGrams,
        uint128 _feeAmount,
        address _remainingGasTo
    ) internal view {
        TvmCell emptyPayload;
        emit MarketFeeWithheld(_feeAmount, _getPaymentToken());
        ITokenWallet(_tokenWallet).transfer{
            value: _deployWalletGrams + _extraGasValue,
            flag: 0,
            bounce: false
        }(
            _feeAmount,
            _getMarketRootAddress(),
            _deployWalletGrams,
            _remainingGasTo,
            false,
            emptyPayload
        );
    }
}