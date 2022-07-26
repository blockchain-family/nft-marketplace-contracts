pragma ton-solidity >= 0.57.0;

library DirectSellStatus {
    uint8 constant Create      = 0;
    uint8 constant AwaitNFT    = 1;
    uint8 constant Active      = 2;
    uint8 constant Filled      = 3;
    uint8 constant Cancelled   = 4;
}