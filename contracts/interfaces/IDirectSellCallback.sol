pragma ever-solidity >= 0.62.0;

interface IDirectSellCallback {
    
    function directSellDeployed(
        uint32 callbackId,
        address directSellAddress,
        address sender, 
        address paymentToken, 
        address nftAddress, 
        uint64 nonce, 
        uint128 price
    ) external;
    
    function directSellDeclined(uint32 callbackId, address sender) external;    

    function directSellSuccess(
        uint32 callbackId,
        address oldOwner,
        address newOwner
    ) external;

    function directSellCancelledOnTime(uint32 callbackId) external; 
}