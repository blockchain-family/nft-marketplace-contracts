pragma ever-solidity >= 0.61.2;

import "../structures/IMarketFeeStructure.sol";
import "../structures/IDiscountCollectionsStructure.sol";

interface IOffersRoot is IMarketFeeStructure, IDiscountCollectionsStructure {

    function setMarketFee(MarketFee _fee) external;
    function setMarketFeeForChildContract(address auction, MarketFee _fee) external;
    function getMarketFee() external view returns (MarketFee);

    function addCollectionsSpecialRules(address collection, CollectionFeeInfo collectionFeeInfo) external;
    function removeCollectionsSpecialRules(address collection) external;
}
