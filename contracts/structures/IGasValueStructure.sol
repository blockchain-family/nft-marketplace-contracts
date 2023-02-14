pragma ton-solidity >= 0.61.2;

interface IGasValueStructure {

   struct GasValues {
        uint128 fixedValue;
        uint128 dynamicGas;
    }
}