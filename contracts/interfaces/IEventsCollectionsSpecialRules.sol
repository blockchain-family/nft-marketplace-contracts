pragma ever-solidity >= 0.61.2;

import "../structures/IDiscountCollectionsStructure.sol";

interface IEventsCollectionsSpecialRules is IDiscountCollectionsStructure {
    event AddCollectionRules(address collection, CollectionFeeInfo collectionFeeInfo);
    event RemoveCollectionRules(address collection);
}