pragma ton-solidity >= 0.57.1;

interface IDirectBuyCallback {
    function directBuyDeployed(
        address directBuyAddress, 
        address sender, 
        address tokenRoot,
        address nft, 
        uint64 nonce, 
        uint128 amount
    ) external;
    
    function directBuyDeployedDeclined(address sender, 
        address tokenRoot, 
        uint128 amount
    ) external;

    function directBuySuccess(
        address oldOwner,
        address newOwner
    ) external;
}