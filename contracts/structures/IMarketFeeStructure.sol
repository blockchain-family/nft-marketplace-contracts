pragma ton-solidity >= 0.61.2;

interface IMarketFeeStructure {

    struct MarketFee {
        uint32 numerator;
        uint32 denominator;
    }
}