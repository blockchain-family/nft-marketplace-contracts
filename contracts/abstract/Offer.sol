pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import '../errors/BaseErrors.sol';
import '../errors/OffersBaseErrors.sol';

import '../interfaces/IOffersRoot.sol';
import "../interfaces/IOffer.sol";

abstract contract Offer is IOffer {

    uint64 static nonce_;
    address public static nft;
    address public static markerRootAddr;

    uint128 public price;
    address public tokenRootAddr;
    address public nftOwner;

    uint128 public deploymentFee;
    // Market fee
    MarketFee fee;

    function setDefaultProperties(
        uint128 _price,
        address _tokenRootAddr,
        address _nftOwner,
        uint128 _deploymentFee,
        MarketFee _fee
    ) 
        internal 
    {   
        price = _price;
        tokenRootAddr = _tokenRootAddr;
        nftOwner = _nftOwner;
        deploymentFee = _deploymentFee;
        fee = _fee;
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
        sendGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function _reserve() internal virtual;
}
