pragma ever-solidity >= 0.61.2;

library DirectSellStatus {
    uint8 constant Create    = 0;
    uint8 constant AwaitNFT  = 1;
    uint8 constant Active    = 2;
    uint8 constant Filled    = 3;
    uint8 constant Cancelled = 4;
    uint8 constant Expired   = 5;
}