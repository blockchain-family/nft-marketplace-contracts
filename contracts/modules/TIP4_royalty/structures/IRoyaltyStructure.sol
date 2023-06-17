pragma ever-solidity ^0.61.2;

interface IRoyaltyStructure {

    struct Royalty {
        uint128 numerator;
        uint128 denominator;
        address receiver;
    }
}