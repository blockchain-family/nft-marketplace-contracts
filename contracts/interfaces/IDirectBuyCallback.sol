pragma ever-solidity >= 0.61.2;

interface IDirectBuyCallback {

    function directBuyDeployed(
        uint32 callbackId,
        address directBuy, 
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
        uint128 amount,
        address nft
    ) external;

    function directBuySuccess(
        uint32 callbackId,
        address oldOwner,
        address newOwner,
        address nft
    ) external;

    function directBuyNotSuccess(
        uint32 callbackId,
        address nft
    ) external;

    function directBuyCancelledOnTime(
        uint32 callbackId,
        address nft
    ) external;

    function directBuyClose(
        uint32 callbackId,
        address nft
    ) external;
}