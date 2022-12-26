pragma ever-solidity >= 0.61.2;

library AuctionErrors {
    uint16 constant auction_still_in_progress = 250;
    uint16 constant bid_is_too_low            = 251;
    uint16 constant wrong_data_sender         = 252;
    uint16 constant auction_not_active        = 253;
    uint16 constant wrong_recipient           = 254;
    uint16 constant wrong_amount              = 255;
    uint16 constant low_gas                   = 256;

}
