pragma ever-solidity >= 0.61.2;

import "../../abstract/BaseOffer.sol";

import "tip3/contracts/interfaces/ITokenWallet.sol";

abstract contract SupportNativeTokenOffer is BaseOffer {

    function weverRoot()
        external
        view
        returns (address)
    {
        return _getWeverRoot();
    }

    function weverVault()
        external
        view
        returns (address)
    {
        return _getWeverVault();
    }

    function _transfer(
        address _paymentToken,
        uint128 _amount,
        address _user,
        address _remainingGasTo,
        address _sender,
        uint128 _value,
        uint16 _flag,
        uint128 _deployWalletGrams,
        TvmCell _payload
    )
        internal
        virtual
    {
        TvmBuilder builder;
        builder.store(_remainingGasTo);
        if (_paymentToken == _getWeverRoot()) {
            ITokenWallet(_sender).transfer{ value: _value, flag: _flag, bounce: false }(
                _amount,
                _getWeverVault(),
                uint128(0),
                _user,
                true,
                builder.toCell()
            );
        } else {
            ITokenWallet(_sender).transfer{ value: _value, flag: _flag, bounce: false }(
                _amount,
                _user,
                _deployWalletGrams,
                _remainingGasTo,
                false,
                _payload
            );
        }
    }
}