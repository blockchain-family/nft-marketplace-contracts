pragma ever-solidity >= 0.61.2;

library OffersBaseErrors {
    uint8 constant not_enough_value_to_deploy    = 200;
    uint8 constant seller_is_not_the_owner       = 201;
    uint8 constant message_sender_is_not_my_root = 202;
    uint8 constant buyer_is_my_owner             = 203;
    uint8 constant not_enough_value_to_buy       = 204;
    uint8 constant token_not_pending             = 205;
    uint8 constant wrong_price                   = 206;
}
