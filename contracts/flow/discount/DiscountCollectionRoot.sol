pragma ever-solidity >= 0.61.2;

import "../../structures/IDiscountCollectionsStructure.sol";
import "../../abstract/BaseRoot.sol";

abstract contract DiscountCollectionRoot is BaseRoot {

    function collectionsSpecialRules() external view {
        _getCollectionsSpecialRules();
    }

    function _getInfoFromCollectionsSpecialRules(
        address _collection
    ) internal view virtual returns (CollectionFeeInfo) {
        return _getCollectionsSpecialRules().at(_collection);
    }

    function _isDiscountCollectionExists(address _collection) internal view returns (bool) {
        return _getCollectionsSpecialRules().exists(_collection);
    }

    function addCollectionsSpecialRules(
        address _collection,
        CollectionFeeInfo _collectionFeeInfo
    ) external onlyOwner reserve() {
//        _reserve();
        require(_collectionFeeInfo.denominator > 0, BaseErrors.denominator_not_be_zero);
        _setCollectionsSpecialRules(_collection, _collectionFeeInfo);
        msg.sender.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function removeCollectionsSpecialRules(address _collection) external onlyOwner reserve()  {
//        _reserve();
        if (_isDiscountCollectionExists(_collection)) {
            _deleteCollectionsSpecialRules(_collection);
        }
        msg.sender.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }
}