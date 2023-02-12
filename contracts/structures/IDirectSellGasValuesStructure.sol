 pragma ton-solidity >= 0.61.2;

interface IDirectSellGasValuesStructure {

    struct GasValues {
        uint128 fixedValue;
        uint128 dynamicGas;
    }

    struct DirectSellGasValues {
        GasValues deploy;
        GasValues sell;
        GasValues buy;
        GasValues cancel;
    }
}