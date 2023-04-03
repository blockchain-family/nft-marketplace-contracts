pragma ever-solidity >= 0.61.2;
import '../errors/BaseErrors.sol';
import '../errors/OffersBaseErrors.sol';

import '../interfaces/IOffersRoot.sol';

import '../modules/access/OwnableInternal.sol';
import "../interfaces/IOffer.sol";
import "../interfaces/IEventsMarketFee.sol";
import "../structures/IGasValueStructure.sol";
import "../interfaces/IEventsRoyalty.sol";

abstract contract OffersRoot is IOffersRoot, IEventsMarketFee, OwnableInternal, IEventsRoyalty, IGasValueStructure {

    MarketFee fee;

    function getMarketFee() external view override returns (MarketFee) {
        return fee;
    }

    function setMarketFee(MarketFee _fee) override external onlyOwner {
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        fee = _fee;
        emit MarketFeeDefaultChanged(_fee);
    }

    function setMarketFeeForChildContract(address auction, MarketFee _fee) external override onlyOwner {
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        IOffer(auction).setMarketFee{value: 0, flag: 64, bounce:false}(_fee, msg.sender);
        emit MarketFeeChanged(auction, _fee);
    }

    function calcValue(GasValues value) internal pure returns(uint128) {
        return value.fixedValue + gasToValue(value.dynamicGas, address(this).wid);
    }

    function addCollectionsSpecialRules(address collection, CollectionFeeInfo collectionFeeInfo) external override onlyOwner {
        collectionsSpecialRules[collection] = collectionFeeInfo;
        emit AddCollectionRules(collection, collectionFeeInfo);
    }

    function removeCollectionsSpecialRules(address collection) external override onlyOwner {
        if (collectionsSpecialRules.exists(collection)) {
            delete collectionsSpecialRules[collection];
            emit RemoveCollectionRules(collection);
        }
    }
}