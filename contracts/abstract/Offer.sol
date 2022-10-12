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
    // Market fee in EVER's
    uint128 public marketFee;
    uint8 public marketFeeDecimals;

    function setDefaultProperties(
        uint128 _price,
        address _markerRootAddr,
        address _tokenRootAddr,
        address _nftOwner,
        uint128 _deploymentFee,
        uint128 _marketFee,
        uint8 _marketFeeDecimals
    ) 
        internal 
    {   
        price = _price;
        markerRootAddr = _markerRootAddr;
        tokenRootAddr = _tokenRootAddr;
        nftOwner = _nftOwner;
        deploymentFee = _deploymentFee;

        uint128 decimals = uint128(uint128(10) ** uint128(_marketFeeDecimals));
        marketFee = math.divc(math.muldiv(price, uint128(_marketFee), uint128(100)), decimals);
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
