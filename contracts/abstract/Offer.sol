pragma ever-solidity >= 0.62.0;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import '../errors/BaseErrors.sol';
import '../errors/OffersBaseErrors.sol';

import '../interfaces/IOffersRoot.sol';

abstract contract Offer {

    uint64 static nonce_;
    address public static nft;

    uint128 public price;
    address public markerRootAddr;
    address public tokenRootAddr;
    address public nftOwner;

    uint128 public deploymentFee;
    // Market fee
    uint32 public marketFeeNumerator;
    uint32 public marketFeeDenominator;

    function setDefaultProperties(
        uint128 _price,
        address _markerRootAddr,
        address _tokenRootAddr,
        address _nftOwner,
        uint128 _deploymentFee,
        uint32 _marketFeeNumerator,
        uint32 _marketFeeDenominator
    ) 
        internal 
    {   
        price = _price;
        markerRootAddr = _markerRootAddr;
        tokenRootAddr = _tokenRootAddr;
        nftOwner = _nftOwner;
        deploymentFee = _deploymentFee;
        marketFeeNumerator = _marketFeeNumerator;
        marketFeeDecimals = _marketFeeDecimals;
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
}
