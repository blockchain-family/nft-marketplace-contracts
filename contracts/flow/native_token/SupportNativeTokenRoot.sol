pragma ever-solidity >= 0.61.2;

import "../../abstract/BaseRoot.sol";

abstract contract SupportNativeTokenRoot is BaseRoot {

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
}