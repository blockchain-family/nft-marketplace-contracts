pragma ever-solidity >= 0.62.0;

interface IDirectBuyCallback {

    function directBuyDeployed(
        uint32 callbackId,
        address directBuyAddress, 
        address sender, 
        address tokenRoot,
        address nft, 
        uint64 nonce, 
        uint128 amount
    ) external;
    
    function directBuyDeployedDeclined(
        uint32 callbackId,
        address sender, 
        address tokenRoot, 
        uint128 amount
    ) external;

    function directBuySuccess(
        address oldOwner,
        address newOwner
    ) external;
     
}