pragma ever-solidity >= 0.61.2;

library DirectBuySellErrors {
    uint16 constant NOT_FROM_SPENT_TOKEN_ROOT         = 300;
    uint16 constant NOT_NFT_MANAGER                   = 301;
    uint16 constant NOT_OWNER_DIRECT_BUY_SELL         = 302;
    uint16 constant NOT_ACTIVE_CURRENT_STATUS         = 303;
    uint16 constant DIRECT_BUY_SELL_IN_STILL_PROGRESS = 304;
    uint16 constant NOT_FACTORY_DIRECT_BUY            = 305;
    uint16 constant NOT_FACTORY_DIRECT_SELL           = 306;
    uint16 constant LOW_GAS                           = 307;
    uint16 constant WRONG_RECIPIENT                  = 308;
}