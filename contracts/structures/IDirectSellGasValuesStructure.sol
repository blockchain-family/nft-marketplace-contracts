pragma ton-solidity >= 0.61.2;

import "./IGasValueStructure.sol";

interface IDirectSellGasValuesStructure {

    struct DirectSellGasValues {
        uint128 gasK;
        IGasValueStructure.GasValues deployWallet;
        IGasValueStructure.GasValues sell;
        IGasValueStructure.GasValues buy;
        IGasValueStructure.GasValues cancel;
    }
}