pragma ton-solidity >= 0.57.1;

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
        address oldOwner,
        address newOwner
    ) external;

}