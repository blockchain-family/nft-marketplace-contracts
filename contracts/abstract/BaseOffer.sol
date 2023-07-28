pragma ever-solidity >= 0.61.2;

import '../errors/BaseErrors.sol';

import "../structures/IGasValueStructure.sol";
import "../structures/IMarketFeeStructure.sol";
import "../structures/IDiscountCollectionsStructure.sol";

import "../interfaces/IEventsMarketFeeOffer.sol";
import "../interfaces/IEventsRoyalty.sol";

import "./TargetBalance.sol";


abstract contract BaseOffer is
    IEventsMarketFeeOffer,
    IDiscountCollectionsStructure,
    IRoyaltyStructure,
    TargetBalance,
    IEventsRoyalty
{
    address private static markerRootAddress_;
    address private static owner_;
    address private static paymentToken_;
    address private static nftAddress_;
    uint64 private static nonce_;

    address private collection_;

    MarketFee private fee_;
    optional(MarketBurnFee) private burnFee_;

    address private weverRoot_;
    address private weverVault_;

    optional(DiscountInfo) private discountOpt_;
    optional(address) private discountNft_;

    optional(Royalty) private royalty_;

    uint64 private deployTime_;

    modifier reserve() {
        tvm.rawReserve(_getTargetBalanceInternal(), 0);
        _;
    }

    modifier onlyOwner() {
        require(
            msg.sender.value != 0 &&
            msg.sender == _getOwner(),
            BaseErrors.message_sender_is_not_my_owner
        );
        _;
    }

    modifier onlyMarketRoot() {
        require(
            msg.sender.value != 0 &&
            msg.sender == _getMarketRootAddress(),
            BaseErrors.message_sender_is_not_my_root
        );
        _;
    }

    modifier onlyPaymentToken() {
        require(
            msg.sender.value != 0 &&
            msg.sender == _getPaymentToken(),
            BaseErrors.operation_not_permited
        );
        _;
    }

    function _initialization(
        MarketFee _fee,
        optional(MarketBurnFee) _burnFee,
        address _weverRoot,
        address _weverVault,
        optional(DiscountInfo) _discountOpt
    )
        internal
        virtual
    {
        deployTime_ = now;
        _setMarketFee(_fee);
        if (_burnFee.hasValue()){
            _setMarketBurnFee(_burnFee.get());
        }
        weverVault_ = _weverVault;
        weverRoot_ = _weverRoot;
        _setDiscountOpt(_discountOpt);
    }

    function _getTargetBalanceInternal()
        internal
        view
        virtual
        override
        returns (uint128);

    function activate()
        external
        onlyMarketRoot
        reserve
    {
        if (!_getRoyalty().hasValue() && now >= _getDeployTime() + 10 minutes) {
            _setRoyalty(Royalty(0, 1000000000, address(0)));
        }
        _checkAndActivate();
    }

    function _checkAndActivate()
        internal
        virtual;

// static
    function _getMarketRootAddress()
        internal
        view
        virtual
        returns (address)
    {
        return markerRootAddress_;
    }

    function _getPaymentToken()
        internal
        view
        virtual
        returns (address)
    {
        return paymentToken_;
    }

    function _getOwner()
        internal
        view
        virtual
        returns (address)
    {
        return owner_;
    }

    function _getNonce()
        internal
        view
        virtual
        returns (uint64)
    {
        return nonce_;
    }

    function _getNftAddress()
        internal
        view
        virtual
        returns (address)
    {
        return nftAddress_;
    }

    function _getCollection()
        internal
        view
        virtual
        returns (address)
    {
        return collection_;
    }

    function _setCollection(
        address _collection
    )
        internal
        virtual
    {
        collection_ = _collection;
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
        emit MarketFeeChanged(address(this), fee_);
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
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        burnFee_ = _fee;
        emit MarketBurnFeeChanged(address(this), burnFee_);
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

// discount collection
    function _setDiscountOpt(
        optional(DiscountInfo) _discountOpt
    )
        internal
        virtual
    {
        discountOpt_ = _discountOpt;
    }

    function _getDiscountOpt()
        internal
        view
        virtual
        returns (optional(DiscountInfo))
    {
        return discountOpt_;
    }

    function _getDiscountNft()
        internal
        view
        virtual
        returns (optional(address))
    {
        return discountNft_;
    }

    function _setDiscountNft(
        address _discountNft
    )
        internal
        virtual
    {
        discountNft_ = _discountNft;
    }

// royalty
    function _getRoyalty()
        internal
        view
        virtual
        returns (optional(Royalty))
    {
        return royalty_;
    }

    function _setRoyalty(Royalty _royalty)
        internal
        virtual
    {
        royalty_ = _royalty;
        emit RoyaltySet(royalty_.get());
    }

    function calcValue(
        IGasValueStructure.GasValues value
    )
        internal
        pure
        returns (uint128)
    {
        return value.fixedValue + gasToValue(value.dynamicGas, address(this).wid);
    }

    function _getDeployTime()
        internal
        view
        virtual
        returns (uint64)
    {
        return deployTime_;
    }
}
