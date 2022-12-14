pragma ever-solidity >= 0.62.0;

library BaseErrors {
    uint8 constant message_sender_is_not_my_owner    = 100;
    uint8 constant token_not_minted                  = 101;
    uint8 constant token_already_granted             = 102;
    uint8 constant wrong_token_id                    = 103;
    uint8 constant not_enough_value                  = 104;
    uint8 constant wrong_manager_address             = 105;
    uint8 constant sender_is_not_manager             = 106;
    uint8 constant zero_owner_for_ownership_transfer = 107;
    uint8 constant operation_not_permited            = 108;
    uint8 constant value_too_low                     = 109;
}
