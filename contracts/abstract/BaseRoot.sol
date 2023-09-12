pragma ever-solidity >= 0.61.2;

import '../errors/BaseErrors.sol';

import "../structures/IGasValueStructure.sol";

import "../structures/IMarketFeeStructure.sol";
import "../structures/IMarketBurnFeeStructure.sol";
import "../structures/IDiscountCollectionsStructure.sol";
import "../interfaces/IEventsCollectionsSpecialRules.sol";
import "../modules/access/OwnableInternal.sol";
import "../interfaces/IEventsMarketFee.sol";
import "./TargetBalance.sol";
import "./BaseOffer.sol";


abstract contract BaseRoot is
    OwnableInternal,
    TargetBalance,
    IGasValueStructure,
    IEventsMarketFee,
    IDiscountCollectionsStructure,
    IEventsCollectionsSpecialRules
{
    MarketFee private fee_;
    optional(MarketBurnFee) private burnFee_;


    address private weverRoot_;
    address private weverVault_;

    TvmCell private offerCode_;
    uint32 private currentVersionOffer_;

    mapping(address => CollectionFeeInfo) private collectionsSpecialRules_;

    modifier reserve() {
        tvm.rawReserve(_getTargetBalanceInternal(), 0);
        _;
    }

    function _getTargetBalanceInternal()
        internal
        view
        virtual
        override
        returns (uint128);


    function _initialization(
        MarketFee _fee,
        address _weverRoot,
        address _weverVault
    )
        internal
        virtual
    {
        _setMarketFee(_fee);
        weverVault_ = _weverVault;
        weverRoot_ = _weverRoot;
    }

    function activateChildContract(
        address _offer
    )
        external
        onlyOwner
    {
        BaseOffer(_offer).activate{value: 0, flag: 64, bounce: false}();
    }

// market fee
    function _setMarketFee(
        MarketFee _fee
    )
        internal
        virtual
    {
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        fee_ = _fee;
        emit MarketFeeDefaultChanged(fee_);
    }

    function _getMarketFee()
        internal
        view
        virtual
        returns (MarketFee)
    {
        return fee_;
    }

// market burn fee

    function _setMarketBurnFee(
        MarketBurnFee _fee
    )
        internal
        virtual
    {
        burnFee_ = _fee;
        emit MarketBurnFeeDefaultChanged(_fee);
    }

    function _getMarketBurnFee()
        internal
        view
        virtual
        returns (optional(MarketBurnFee))
    {
        return burnFee_;
    }

// support native token
    function _getWeverRoot()
        internal
        view
        virtual
        returns (address)
    {
        return weverRoot_;
    }

    function _getWeverVault()
        internal
        view
        virtual
        returns (address)
    {
        return weverVault_;
    }

// discount
    function _getCollectionsSpecialRules()
        internal
        view
        virtual
        returns (mapping(address => CollectionFeeInfo))
    {
        return collectionsSpecialRules_;
    }

    function _setCollectionsSpecialRules(
        address _collection,
        CollectionFeeInfo _collectionFeeInfo
    )
        internal
        virtual
    {
        collectionsSpecialRules_[_collection] = _collectionFeeInfo;
        emit AddCollectionRules(_collection, _collectionFeeInfo);
    }

    function _deleteCollectionsSpecialRules(
        address _collection
    )
        internal
        virtual
    {
        delete collectionsSpecialRules_[_collection];
        emit RemoveCollectionRules(_collection);
    }

// upgradable
    function _getOfferCode()
        internal
        view
        virtual
        returns (TvmCell)
    {
        return offerCode_;
    }

    function _getCurrentVersionOffer()
        internal
        view
        virtual
        returns (uint32)
    {
        return currentVersionOffer_;
    }

    function _setOfferCode(
        TvmCell _newCode
    )
        internal
        virtual
    {
        offerCode_ = _newCode;
        currentVersionOffer_++;
    }

    function calcValue(
        GasValues value
    )
        internal
        pure
        returns(uint128)
    {
        return value.fixedValue + gasToValue(value.dynamicGas, address(this).wid);
    }

}