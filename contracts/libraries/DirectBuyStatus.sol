pragma ever-solidity >= 0.62.0;

library DirectBuyStatus {
    uint8 constant Create      = 0;
    uint8 constant AwaitTokens = 1;
    uint8 constant Active      = 2;
    uint8 constant Filled      = 3;
    uint8 constant Cancelled   = 4;
    uint8 constant Expired     = 5;
}