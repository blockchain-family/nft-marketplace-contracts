pragma ever-solidity >= 0.61.2;

library AuctionStatus {
        uint8 constant Created   = 0;
        uint8 constant Active    = 1;
        uint8 constant Complete  = 2;
        uint8 constant Cancelled = 3;
}