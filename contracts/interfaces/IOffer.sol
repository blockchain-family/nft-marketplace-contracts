pragma ever-solidity >= 0.61.2;

import "../structures/IMarketFeeStructure.sol";

interface IOffer is IMarketFeeStructure {

    function setMarketFee(MarketFee _fee, address sendGasTo) external;
    function getMarketFee() external view returns (MarketFee);
}