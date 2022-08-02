pragma ton-solidity >= 0.62.0;

library Gas {
    uint128 constant DEPLOY_AUCTION_VALUE            = 3 ton;
    uint128 constant AUCTION_INITIAL_BALANCE         = 1 ton;
    uint128 constant AUCTION_ROOT_INITIAL_BALANCE    = 5 ton;
    uint128 constant TOKENS_RECEIVED_CALLBACK_VALUE  = 1 ton;
    uint128 constant FINISH_AUCTION_VALUE            = 1.3 ton;

    // tip3
    uint128 constant DEPLOY_EMPTY_WALLET_VALUE       = 0.5 ton;
    uint128 constant DEPLOY_EMPTY_WALLET_GRAMS       = 0.1 ton;
    uint128 constant GET_WALLET_ADDRESS_VALUE        = 1.2 ton;
    uint128 constant SET_RECEIVE_CALLBACK_VALUE      = 0.5 ton;
    uint128 constant GET_TOKEN_WALLET_DETAILS        = 0.5 ton;
    uint128 constant TRANSFER_TO_RECIPIENT_VALUE     = 0.2 ton;

    // true nft
    uint128 constant TRANSFER_OWNERSHIP_VALUE        = 1.1 ton;

    // direct buy
    uint128 constant DIRECT_BUY_INITIAL_BALANCE      = 1 ton;
    uint128 constant DEPLOY_DIRECT_BUY_MIN_VALUE     = 2 ton;
    uint128 constant GET_BALANCE_WALLET              = 0.1 ton; //?
    
    // direct sell
    uint128 constant DIRECT_SELL_INITIAL_BALANCE      = 1 ton;
    uint128 constant DEPLOY_DIRECT_SELL_MIN_VALUE     = 2 ton;
}
