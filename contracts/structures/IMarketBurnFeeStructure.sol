pragma ton-solidity >= 0.61.2;

interface IMarketBurnFeeStructure {

    struct MarketBurnFee {
        uint32 numerator;
        uint32 denominator;
        address project;
        address burnRecipient;
    }
}