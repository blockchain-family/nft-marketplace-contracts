pragma ever-solidity >= 0.61.2;

interface IDirectSellCallback {
    
    function directSellDeployed(
        uint32 callbackId,
        address directSell,
        address sender, 
        address paymentToken, 
        address nft, 
        uint64 nonce, 
        uint128 price
    ) external;
    
    function directSellDeclined(
        uint32 callbackId,
        address sender,
        address nft
    ) external;    

    function directSellSuccess(
        uint32 callbackId,
        address oldOwner,
        address newOwner,
        address nft
    ) external;

    function directSellNotSuccess(
        uint32 callbackId,
        address nft
    ) external;

    function directSellCancelledOnTime(
        uint32 callbackId,
        address nft
    ) external; 

    function directSellClose(
        uint32 callbackId,
        address nft
    ) external;
}