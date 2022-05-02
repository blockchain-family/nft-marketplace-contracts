pragma ton-solidity >=0.57.1;

library AuctionErrors {
    uint8 constant auction_still_in_progress = 250;
    uint8 constant bid_is_too_low = 251;
    uint8 constant wrong_data_sender = 252;
}
