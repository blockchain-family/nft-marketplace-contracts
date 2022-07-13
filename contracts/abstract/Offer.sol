pragma ton-solidity >=0.57.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import '../errors/BaseErrors.sol';
import '../errors/OffersBaseErrors.sol';

import '../interfaces/IOffersRoot.sol';
// import '../../true-nft/contracts/interfaces/IData.sol';


abstract contract Offer {

    uint64 static nonce_;

    uint128 public static price;
    address public static nft;

    address public markerRootAddr;
    address public tokenRootAddr;
    address public nftOwner;

    uint128 public deploymentFee;
    // Market fee in EVER's
    uint128 public marketFee;
    uint8 public marketFeeDecimals;

    function setDefaultProperties(
        address _markerRootAddr,
        address _tokenRootAddr,
        address _nftOwner,
        uint128 _deploymentFee,
        uint128 _marketFee,
        uint8 _marketFeeDecimals
    ) 
        internal 
    {
        markerRootAddr = _markerRootAddr;
        tokenRootAddr = _tokenRootAddr;
        nftOwner = _nftOwner;
        deploymentFee = _deploymentFee;

        uint128 decimals = uint128(uint128(10) ** uint128(_marketFeeDecimals));
        marketFee = math.divc(math.muldiv(price, uint128(_marketFee), uint128(100)), decimals);
        marketFeeDecimals = _marketFeeDecimals;
    }

    modifier onlyOwner() {
        require(msg.sender.value != 0 && msg.sender == nftOwner, BaseErrors.message_sender_is_not_my_owner);
        _;
    }

    modifier onlyMarketRoot() {
        require(msg.sender.value != 0 && msg.sender == markerRootAddr, OffersBaseErrors.message_sender_is_not_my_root);
        _;
    }
}
