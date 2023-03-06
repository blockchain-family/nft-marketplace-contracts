pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import '../errors/BaseErrors.sol';
import '../errors/OffersBaseErrors.sol';

import '../interfaces/IOffersRoot.sol';

import '../modules/access/OwnableInternal.sol';
import "../interfaces/IOffer.sol";
import "../interfaces/IEventsMarketFee.sol";

abstract contract OffersRoot is IOffersRoot, IEventMarketFee, OwnableInternal {
    uint16 public auctionBidDelta;
    uint16 public auctionBidDeltaDecimals;
    uint128 public deploymentFee;
    uint128 deploymentFeePart;

    TvmCell codeNft;
    TvmCell offerCode;

    MarketFee fee;

    function setDefaultProperties(
        TvmCell _codeNft,
        address _owner,
        TvmCell _offerCode,
        uint128 _deploymentFee,
        MarketFee _fee,
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
        fee = _fee;
        emit MarketFeeDefaultChanged(_fee);
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

    function getMarketFee() external view override returns (MarketFee) {
        return fee;
    }

    function setMarketFee(MarketFee _fee) override external onlyOwner {
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        fee = _fee;
        emit MarketFeeDefaultChanged(_fee);
    }

    function _reserve() internal virtual;

    function setMarketFeeForAuction(address auction, MarketFee _fee) external override onlyOwner {
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        IOffer(auction).setMarketFee{value: 0, flag: 64, bounce:false}(_fee, msg.sender);
        emit MarketFeeChanged(auction, _fee);
    }

}
