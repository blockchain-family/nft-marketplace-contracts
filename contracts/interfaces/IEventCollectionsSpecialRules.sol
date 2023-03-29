pragma ever-solidity >= 0.61.2;

import "../structures/IDiscountCollectionsStructure.sol";

interface IEventCollectionsSpecialRules is IDiscountCollectionsStructure {
    event AddCollectionRules(address collection, CollectionFeeInfo collectionFeeInfo);
    event RemoveCollectionRules(address collection);
}