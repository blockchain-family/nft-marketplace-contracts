pragma ever-solidity >= 0.61.2;

import "../structures/IMarketFeeStructure.sol";
import "../structures/IMarketBurnFeeStructure.sol";


interface IEventsMarketFee is IMarketFeeStructure, IMarketBurnFeeStructure {

    event MarketFeeDefaultChanged(MarketFee fee);
    event MarketBurnFeeDefaultChanged(optional(MarketBurnFee) fee);
    event MarketFeeChanged(address auction, MarketFee fee);
    event MarketBurnFeeChanged(address auction, optional(MarketBurnFee) fee);
    event MarketFeeWithdrawn(address recipient, uint128 amount, address tokenWallet);

}