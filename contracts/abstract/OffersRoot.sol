pragma ever-solidity >= 0.61.2;
import '../errors/BaseErrors.sol';
import '../errors/OffersBaseErrors.sol';

import '../interfaces/IOffersRoot.sol';

import "../libraries/Gas.sol";

import '../modules/access/OwnableInternal.sol';
import "../interfaces/IOffer.sol";
import "../interfaces/IEventsMarketFee.sol";
import "../structures/IGasValueStructure.sol";
import "../interfaces/IEventsRoyalty.sol";
import "../interfaces/IEventsCollectionsSpecialRules.sol";
import "tip3/contracts/interfaces/ITokenWallet.sol";

abstract contract OffersRoot is IOffersRoot, IOffer, IEventsMarketFee, OwnableInternal, IEventsCollectionsSpecialRules {

    MarketFee fee;
    mapping (address => CollectionFeeInfo) public collectionsSpecialRules;

    constructor(
        MarketFee _fee,
        address _owner
    ) OwnableInternal (
        _owner
    ) public
    {
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        fee = _fee;
        emit MarketFeeDefaultChanged(_fee);
    }

    function _reserve() internal virtual;

    function getMarketFee() external view override returns (MarketFee) {
        return fee;
    }

    function setMarketFeeForChildContract(address offer, MarketFee _fee) external override onlyOwner {
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        IOffer(offer).setMarketFee{value: 0, flag: 64, bounce:false}(_fee, msg.sender);
        emit MarketFeeChanged(offer, _fee);
    }

    function setMarketFee(MarketFee _fee) external override onlyOwner {
        _reserve();
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        fee = _fee;
        emit MarketFeeDefaultChanged(_fee);
        msg.sender.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function calcValue(GasValues value) internal pure returns(uint128) {
        return value.fixedValue + gasToValue(value.dynamicGas, address(this).wid);
    }

    function addCollectionsSpecialRules(address collection, CollectionFeeInfo collectionFeeInfo) external override onlyOwner {
        _reserve();
        require(collectionFeeInfo.denominator > 0, BaseErrors.denominator_not_be_zero);
        collectionsSpecialRules[collection] = collectionFeeInfo;
        emit AddCollectionRules(collection, collectionFeeInfo);
        msg.sender.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function removeCollectionsSpecialRules(address collection) external override onlyOwner {
        _reserve();
        if (collectionsSpecialRules.exists(collection)) {
            delete collectionsSpecialRules[collection];
            emit RemoveCollectionRules(collection);
        }
        msg.sender.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function withdraw(address tokenWallet, uint128 amount, address recipient, address remainingGasTo) external onlyOwner {
        require(recipient.value != 0,  BaseErrors.wrong_recipient);
        require(msg.value >= Gas.WITHDRAW_VALUE, BaseErrors.low_gas);

        _reserve();
        TvmCell emptyPayload;
        ITokenWallet(tokenWallet).transfer{value: 0, flag: 128, bounce: false }
            (amount, recipient, Gas.DEPLOY_EMPTY_WALLET_GRAMS, remainingGasTo, false, emptyPayload);
        emit MarketFeeWithdrawn(recipient, amount, tokenWallet);
        msg.sender.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }
}