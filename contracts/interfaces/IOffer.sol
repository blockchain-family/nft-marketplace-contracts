pragma ever-solidity >= 0.61.2;

import "../structures/IMarketFeeStructure.sol";

interface IOffer is IMarketFeeStructure {


    function getTypeContract() external pure returns (string);
}