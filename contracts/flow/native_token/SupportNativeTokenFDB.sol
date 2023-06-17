pragma ever-solidity >= 0.61.2;

import "./SupportNativeTokenRoot.sol";

import "tip3/contracts/interfaces/ITokenWallet.sol";

abstract contract SupportNativeTokenFDB is SupportNativeTokenRoot {

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
        address remainingGasTo;
        TvmSlice payloadSlice = payload.toSlice();
        if (payloadSlice.bits() >= 267) {
            remainingGasTo = payloadSlice.decode(address);
        }

        if (user == remainingGasTo) {
            user.transfer({ value: 0, flag: 128 + 2, bounce: false });
        } else {
            user.transfer({ value: amount, flag: 1, bounce: false });
            remainingGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
        }
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