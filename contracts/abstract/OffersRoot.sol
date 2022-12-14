pragma ever-solidity >= 0.62.0;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import '../errors/BaseErrors.sol';
import '../errors/OffersBaseErrors.sol';

import '../interfaces/IOffersRoot.sol';

import '../modules/access/OwnableInternal.sol';


abstract contract OffersRoot is IOffersRoot, OwnableInternal {
    uint32 public marketFeeNumerator;
    uint32 public marketFeeDenominator;
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
        uint32 _marketFeeNumerator,
        uint32 _marketFeeDenominator,
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
        marketFeeNumerator = _marketFeeNumerator;
        marketFeeDenominator = _marketFeeDenominator;
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

    function changeMarketFee(uint32 _numerator, uint32 _denominator) override external onlyOwner {
        tvm.accept();
        marketFeeNumerator = _numerator;
        marketFeeDenominator = _denominator;
    }

}
