pragma ever-solidity >= 0.61.2;

import "../structures/IRoyaltyStructure.sol";


interface IEventsRoyalty {
    event RoyaltySet(IRoyaltyStructure.Royalty _royalty);
    event RoyaltyWithdrawn(address recipient, uint128 amount, address paymentToken);
}