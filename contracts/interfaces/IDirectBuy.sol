pragma ton-solidity >= 0.62.0;

interface IDirectBuy {

    struct DirectBuyDetails {
        address factory;
        address creator;
        address spentToken;
        address nft;
        uint64 _timeTx;
        uint128 _price;
        address spentWallet;
        uint8 status;
        address sender;
        uint64 startTimeBuy;
        uint64 durationTimeBuy;
        uint64 endTimeBuy;
    }

    event DirectBuyDeployed(
        address directBuyAddress, 
        address sender, 
        address tokenRoot, 
        address nft, 
        uint64 nonce, 
        uint128 amount
    );

    event DirectBuyDeclined(
        address sender, 
        address tokenRoot, 
        uint128 amount
    );

    event DirectBuyStateChanged(
        uint8 from, 
        uint8 to, 
        DirectBuyDetails
    );

    function directBuyDeployedCallback(
        address directBuyAddress, 
        address sender, 
        address tokenRoot,
        address nft, 
        uint64 nonce, 
        uint128 amount
    ) external;
    
    function directBuyDeployedDeclinedCallback(
        address sender, 
        address tokenRoot, 
        uint128 amount
    ) external;

    function directBuySuccessCallback(
        address oldOwner,
        address newOwner
    ) external;

     
}