pragma ever-solidity >= 0.62.0;

interface IDirectBuyCallback {

    function directBuyDeployed(
        uint32 callbackId,
        address directBuyAddress, 
        address sender, 
        address token,
        address nft, 
        uint64 nonce, 
        uint128 amount
    ) external;
    
    function directBuyDeployedDeclined(
        uint32 callbackId,
        address sender, 
        address token, 
        uint128 amount
    ) external;

    function directBuySuccess(
        uint32 callbackId,
        address oldOwner,
        address newOwner
    ) external;

    function directBuyCancelledOnTime(uint32 callbackId) external;
}