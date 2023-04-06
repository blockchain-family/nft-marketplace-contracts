pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import '../errors/BaseErrors.sol';
import '../errors/OffersBaseErrors.sol';

import '../interfaces/IOffersRoot.sol';
import "../interfaces/IOffer.sol";
import "../interfaces/IEventsMarketFeeOffers.sol";

abstract contract Offer is IOffer, IEventsMarketFeeOffers {

    address public tokenRootAddr;
    address public nftOwner;

    // Market fee
    MarketFee fee;

    function setDefaultProperties(
        address _tokenRootAddr,
        address _nftOwner,
        MarketFee _fee
    ) 
        internal 
    {
        tokenRootAddr = _tokenRootAddr;
        nftOwner = _nftOwner;
        fee = _fee;
        emit MarketFeeChanged(address(this), fee);
    }

    modifier onlyOwner() {
        require(
            msg.sender.value != 0 &&
            msg.sender == nftOwner, 
            BaseErrors.message_sender_is_not_my_owner
        );

        _;
    }

    modifier onlyMarketRoot() {
        require(
            msg.sender.value != 0 && 
            msg.sender == markerRootAddr, 
            OffersBaseErrors.message_sender_is_not_my_root
        );
        _;
    }

    function getMarketFee() external view override returns (MarketFee) {
        return fee;
    }

    function setMarketFee(MarketFee _fee, address sendGasTo) external override onlyMarketRoot {
        _reserve();
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        fee = _fee;
        emit MarketFeeChanged(address(this), fee);
        sendGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function _reserve() internal virtual {
        tvm.rawReserve(Gas.AUCTION_INITIAL_BALANCE, 0);
    }

    function calcValue(IGasValueStructure.GasValues value) internal pure returns(uint128) {
        return value.fixedValue + gasToValue(value.dynamicGas, address(this).wid);
    }
}
