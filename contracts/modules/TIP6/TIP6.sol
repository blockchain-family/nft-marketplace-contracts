pragma ever-solidity = 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;

import './ITIP6.sol';

abstract contract TIP6 is ITIP6 {

    mapping(bytes4 => bool) internal _supportedInterfaces;

    function supportsInterface(
        bytes4 interfaceID
    ) external override view responsible returns (bool) {
        return {value: 0, flag: 64, bounce: false} _supportedInterfaces[interfaceID];
    }

}