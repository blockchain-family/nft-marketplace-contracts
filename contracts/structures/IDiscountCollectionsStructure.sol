pragma ton-solidity >= 0.61.2;

interface IDiscountCollectionsStructure {

    struct DiscountInfo {
        address collection;
        uint256 nftId;
        CollectionFeeInfo feeInfo;
    }

    struct CollectionFeeInfo {
        uint256 codeHash;
        uint16 codeDepth;
        uint32 numerator;
        uint32 denominator;
    }
}