pragma ever-solidity >= 0.61.2;

library Gas {

    uint128 constant FRONTENT_CALLBACK_VALUE                = 0.1 ever;
    uint128 constant NFT_CALLBACK_VALUE                     = 0.01 ever;
    uint128 constant DEPLOY_EMPTY_WALLET_GRAMS              = 0.12 ever;
    uint128 constant DEPLOY_WALLET_ROOT_COMPENSATION        = 0.1 ever;
    uint128 constant DEPLOY_WALLET_EXTRA_GAS                = 0.1 ever;
    uint128 constant TOKEN_TRANSFER_VALUE                   = 0.3 ever;
    uint128 constant FEE_DEPLOY_WALLET_GRAMS                = 0.05 ever;
    uint128 constant FEE_EXTRA_VALUE                        = 0.1 ever;
    uint128 constant TRANSFER_OWNERSHIP_VALUE               = 1.01 ever;

    uint128 constant BUY_EXTRA_GAS_VALUE                    = 0.5 ever;
    uint128 constant SELL_EXTRA_GAS_VALUE                   = 0.3 ever;
    uint128 constant CANCEL_EXTRA_GAS_VALUE                 = 0.15 ever;

    // direct sell
    uint128 constant FACTORY_DIRECT_SELL_INITIAL_BALANCE    = 0.2 ever;
    uint128 constant DIRECT_SELL_INITIAL_BALANCE            = 0.15 ever;

    // Auction
    uint128 constant AUCTION_INITIAL_BALANCE                = 0.15 ever;
    uint128 constant AUCTION_ROOT_INITIAL_BALANCE           = 0.5 ever;

    uint128 constant FACTORY_DIRECT_BUY_INITIAL_BALANCE     = 0.3 ever;
    uint128 constant DIRECT_BUY_INITIAL_BALANCE             = 0.15 ever;

    uint128 constant TOKENS_RECEIVED_CALLBACK_VALUE         = 1 ever;
    uint128 constant FINISH_AUCTION_VALUE                   = 1.3 ever;
    uint128 constant WITHDRAW_VALUE                         = 0.5 ever;
    uint128 constant FEE_VALUE                              = 0.2 ever;

    // direct buy
    uint128 constant DEPLOY_AUCTION_VALUE                   = 1.5 ever;
    uint128 constant UPGRADE_AUCTION_ROOT_MIN_VALUE         = 5 ever;
    uint128 constant CALLBACK_VALUE                         = 0.1 ever;

    // tip3
    uint128 constant DEPLOY_EMPTY_WALLET_VALUE              = 0.5 ever;

    // direct buy
    uint128 constant DEPLOY_DIRECT_BUY_MIN_VALUE            = 2 ever;
    uint128 constant UPGRADE_DIRECT_BUY_MIN_VALUE           = 5 ever;

    // direct sell
    uint128 constant DEPLOY_DIRECT_SELL_MIN_VALUE           = 2 ever;
    uint128 constant UPGRADE_DIRECT_SELL_MIN_VALUE          = 5 ever;
    uint128 constant FINISH_ORDER_VALUE                     = 1 ever;
    uint128 constant SET_CODE                               = 1 ever;



}
