pragma ton-solidity >= 0.61.2;

import "./IGasValueStructure.sol";

interface IAuctionGasValuesStructure {

    struct AuctionGasValues {
        uint128 gasK;
        IGasValueStructure.GasValues deployWallet;
        IGasValueStructure.GasValues royalty;
        IGasValueStructure.GasValues deployAuction;
        IGasValueStructure.GasValues start;
        IGasValueStructure.GasValues bid;
        IGasValueStructure.GasValues cancel;
    }
}