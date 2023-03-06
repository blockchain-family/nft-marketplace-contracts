pragma ton-solidity >= 0.61.2;

import "./IGasValueStructure.sol";

interface IDirectBuyGasValuesStructure {

    struct DirectBuyGasValues {
        uint128 gasK;
        IGasValueStructure.GasValues deployWallet;
        IGasValueStructure.GasValues deployDirectBuy;
        IGasValueStructure.GasValues make;
        IGasValueStructure.GasValues accept;
        IGasValueStructure.GasValues cancel;
    }
}