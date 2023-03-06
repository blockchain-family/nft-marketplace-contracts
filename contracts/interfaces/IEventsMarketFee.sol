pragma ever-solidity >= 0.61.2;

import "../structures/IMarketFeeStructure.sol";

interface IEventMarketFee is IMarketFeeStructure {
    event MarketFeeDefaultChanged(MarketFee fee);
    event MarketFeeChanged(address auction, MarketFee fee);
    event MarketFeeWithdrawn(address recipient, uint128 amount, address tokenWallet);

}