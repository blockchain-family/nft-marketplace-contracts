pragma ever-solidity >= 0.61.2;

import "../structures/IMarketFeeStructure.sol";

interface IOffersRoot is IMarketFeeStructure {

    function changeDeploymentFee(uint128 _value) external;
    function changeBidDelta(uint16 _auctionBidDelta, uint16 _auctionBidDeltaDecimals) external;
    function setMarketFee(MarketFee _fee) external;
    function setMarketFeeForAuction(address auction, MarketFee _fee) external;
    function getMarketFee() external view returns (MarketFee);
}
