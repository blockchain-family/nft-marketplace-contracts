pragma ever-solidity >= 0.62.0;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import '../errors/BaseErrors.sol';
import '../errors/OffersBaseErrors.sol';

import '../interfaces/IOffersRoot.sol';

import '../modules/access/OwnableInternal.sol';


abstract contract OffersRoot is IOffersRoot, OwnableInternal {
    uint8 public marketFee;
    uint8 public marketFeeDecimals;
    uint16 public auctionBidDelta;
    uint16 public auctionBidDeltaDecimals;
    uint128 public deploymentFee;
    uint128 deploymentFeePart;

    TvmCell codeNft;
    TvmCell offerCode;

    function setDefaultProperties(
        TvmCell _codeNft,
        address _owner,
        TvmCell _offerCode,
        uint128 _deploymentFee,
        uint8 _marketFee, 
        uint8 _marketFeeDecimals,
        uint16 _auctionBidDelta,
        uint16 _auctionBidDeltaDecimals
    )  
        internal
    {
        // Declared in DataResolver
        codeNft = _codeNft;

        offerCode = _offerCode;

        _transferOwnership(_owner);

        deploymentFee = _deploymentFee;
        marketFee = _marketFee;
        marketFeeDecimals = _marketFeeDecimals;
        auctionBidDelta = _auctionBidDelta;
        auctionBidDeltaDecimals = _auctionBidDeltaDecimals;

        (deploymentFeePart, ) = math.divmod(deploymentFee, 4);
    }

    function changeDeploymentFee(uint128 _value) override external onlyOwner {
        tvm.accept();
        deploymentFee = _value;
        (deploymentFeePart, ) = math.divmod(deploymentFee, 4);
    }

    function changeBidDelta(uint16 _auctionBidDelta, uint16 _auctionBidDeltaDecimals) override external onlyOwner {
        tvm.accept();
        auctionBidDelta = _auctionBidDelta;
        auctionBidDeltaDecimals = _auctionBidDeltaDecimals;
    }

    function changeMarketFee(uint8 _value, uint8 _decimals) override external onlyOwner {
        tvm.accept();
        marketFee = _value;
        marketFeeDecimals = _decimals;
    }

}
