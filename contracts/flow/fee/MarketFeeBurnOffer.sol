pragma ever-solidity >= 0.61.2;

import "./MarketFeeOffer.sol";
import "../../structures/IMarketBurnFeeStructure.sol";
import "../../interfaces/IBurnVenom.sol";
import "tip3/contracts/interfaces/IBurnableTokenWallet.sol";

abstract contract MarketFeeBurnOffer is MarketFeeOffer, IMarketBurnFeeStructure {

    MarketBurnFee burnFee;

    function setMarketBurnFee(
        MarketBurnFee _fee,
        address _remainingGasTo
    )
        external
        onlyMarketRoot
        reserve
    {
        burnFee = _fee;
        _remainingGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
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
        uint128 burnFee = math.muldivc(_feeAmount, burnFee.numerator, burnFee.denominator);

        TvmCell emptyPayload;
        emit MarketFeeWithheld(_feeAmount - burnFee, _getPaymentToken());
        ITokenWallet(_tokenWallet).transfer{
            value: _deployWalletGrams + _extraGasValue,
            flag: 0,
            bounce: false
        }(
            _feeAmount - burnFee,
            _getMarketRootAddress(),
            _deployWalletGrams,
            _remainingGasTo,
            false,
            emptyPayload
        );

        IBurnableTokenWallet(_tokenWallet).burn{
            value: _deployWalletGrams + _extraGasValue,
            flag: 0,
            bounce: false
        }(
            burnFee,
            _getMarketRootAddress(),
            address(this),
            emptyPayload
        );

    }

    function onAcceptTokensBurn(
        uint128 amount,
        address /*walletOwner*/,
        address /*wallet*/,
        address user,
        TvmCell payload
    )
         external
         reserve
    {
        require(msg.sender.value != 0 && msg.sender == _getWeverRoot(), BaseErrors.not_wever_root);

        IBurnVenom(burnFee.burnRecipient).burn{
            value: 0,
            flag: 128 + 2,
            bounce: false
        }(_getOwner(), burnFee.project);
    }

}