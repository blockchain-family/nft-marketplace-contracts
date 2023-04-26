pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;


abstract contract SupportNativeTokenOffer {

    address private weverRoot;
    address private weverVault;

    constructor(
        address _weverRoot,
        address _weverVault
    ) {
        weverRoot = _weverRoot;
        weverVault = _weverVault;
    }

    function _getWeverRoot() internal view virtual returns (address) {
        return weverRoot;
    }

    function _getWeverVault() internal view virtual returns (address) {
        return weverVault;
    }

    function weverRoot() external view {
        _getWeverRoot();
    }

    function weverVault() external view {
        _getWeverVault();
    }

    function onAcceptTokensBurn(
        uint128 amount,
        address /*walletOwner*/,
        address /*wallet*/,
        address user,
        TvmCell payload
    )  external {
        address remainingGasTo;
        TvmSlice payloadSlice = payload.toSlice();
        if (payloadSlice.bits() >= 267) {
            remainingGasTo = payloadSlice.decode(address);
        }
        require(msg.sender.value != 0 && msg.sender == _getWeverRoot(), BaseErrors.not_wever_root);
        _reserve();

        if (user == remainingGasTo) {
            user.transfer({ value: 0, flag: 128 + 2, bounce: false });
        } else {
            user.transfer({ value: amount, flag: 1, bounce: false });
            remainingGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
        }
   }

    function _transfer(
        uint128 amount,
        address paymentToken,
        address user,
        address remainingGasTo,
        address sender,
        uint128 value,
        uint16 flag,
        uint128 deployWalletGrams,
        TvmCell payload
    ) private {
        TvmBuilder builder;
        builder.store(remainingGasTo);
        TvmCell emptyPayload;
        if (_getPaymentToken() == _getWeverRoot()) {
            ITokenWallet(sender).transfer{ value: value, flag: flag, bounce: false }(
                amount,
                _getWeverVault(),
                uint128(0),
                user,
                true,
                builder.toCell()
            );
        } else {
            ITokenWallet(sender).transfer{ value: value, flag: flag, bounce: false }(
                amount,
                user,
                deployWalletGrams,
                remainingGasTo,
                false,
                payload
            );
        }
    }
}