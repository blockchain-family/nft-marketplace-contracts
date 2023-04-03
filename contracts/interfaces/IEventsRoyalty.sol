pragma ever-solidity >= 0.61.2;


interface IEventsRoyalty {
    event RoyaltyWithheld(address recipient, uint128 amount, address tokenWallet);
}