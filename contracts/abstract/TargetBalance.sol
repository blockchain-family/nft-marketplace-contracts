pragma ever-solidity >= 0.61.2;

abstract contract TargetBalance  {
    /// @dev Internal call to get target balance
    /// @dev Should be implemented by developer
    /// @return uint128 Balance to keep on the contract
    function _getTargetBalanceInternal()
        internal
        view
        virtual
        returns (uint128);

    function getTargetBalance()
        external
        view
        responsible
        returns (uint128)
    {
        return {
            value: 0,
            flag: 128,
            bounce: false
        } _getTargetBalanceInternal();
    }
}