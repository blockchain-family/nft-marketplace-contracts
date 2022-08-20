pragma ton-solidity >= 0.62.0;

interface IDirectSellCallback {
    function directSellDeployed(
        address directSellAddress,
        address sender, 
        address paymentToken, 
        address nftAddress, 
        uint64 nonce, 
        uint128 price
    ) external;
    
    function directSellDeclined(address sender) external;    

    function directSellSuccess(
        uint32 callbackId,
        address oldOwner,
        address newOwner
    ) external;

    function directSellCancelledOnTime(uint32 callbackId) external; 
}