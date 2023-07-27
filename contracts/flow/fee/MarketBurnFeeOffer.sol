pragma ever-solidity >= 0.61.2;

import "./MarketFeeOffer.sol";
import "../../structures/IMarketBurnFeeStructure.sol";
import "../../interfaces/IBurnTip3.sol";
import "../../libraries/Gas.sol";

import "tip3/contracts/interfaces/IBurnableTokenWallet.sol";

abstract contract MarketBurnFeeOffer is MarketFeeOffer {

    function setMarketBurnFee(
        MarketBurnFee _fee,
        address _remainingGasTo
    )
        external
        onlyMarketRoot
        reserve
    {
        _setMarketBurnFee(_fee);
        _remainingGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function marketBurnFee()
        external
        view
        returns (optional(MarketBurnFee))
    {
        return _getMarketBurnFee();
    }

    function _retentionMarketFee(
        address _tokenWallet,
        uint128 _extraGasValue,
        uint128 _deployWalletGrams,
        uint128 _feeAmount,
        address _remainingGasTo
    )
        internal
        override
        view
    {
        TvmCell emptyPayload;
        optional(MarketBurnFee) burnFee = _getMarketBurnFee();
        if (burnFee.hasValue()) {
            uint128 burnFeeAmount = math.muldivc(_feeAmount, burnFee.get().numerator, burnFee.get().denominator);

            emit MarketFeeWithheld(_feeAmount - burnFeeAmount, _getPaymentToken());
            ITokenWallet(_tokenWallet).transfer{
                value: _deployWalletGrams + _extraGasValue,
                flag: 0,
                bounce: false
            }(
                _feeAmount - burnFeeAmount,
                _getMarketRootAddress(),
                _deployWalletGrams,
                _remainingGasTo,
                false,
                emptyPayload
            );

            IBurnableTokenWallet(_tokenWallet).burn{
                value: Gas.TOKEN_BURN_VALUE + _extraGasValue,
                flag: 0,
                bounce: false
            }(
                burnFeeAmount,
                _getMarketRootAddress(),
                address(this),
                emptyPayload
            );
         } else {

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

    function _tokensBurn()
         internal
         reserve
    {
        optional(MarketBurnFee) burnFee = _getMarketBurnFee();
        if (burnFee.hasValue()) {
            emit MarketFeeBurn(address(this), burnFee.get().burnRecipient, burnFee.get().project);
            IBurnTip3(burnFee.get().burnRecipient).burn{
                value: 0,
                flag: 128 + 2,
                bounce: false
            }(_getOwner(), burnFee.get().project);
        }
    }

}

// else {
//            address remainingGasTo;
//            TvmSlice payloadSlice = payload.toSlice();
//            if (payloadSlice.bits() >= 267) {
//                remainingGasTo = payloadSlice.decode(address);
//            }
//
//            if (user == remainingGasTo) {
//                user.transfer({ value: 0, flag: 128 + 2, bounce: false });
//            } else {
//                user.transfer({ value: amount, flag: 1, bounce: false });
//                remainingGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
//            }
//        }