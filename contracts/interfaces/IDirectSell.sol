pragma ton-solidity >= 0.62.0;

interface IDirectSell {
    
    struct DirectSellDetails {
        address factory;
        address creator;
        address token;
        address nft;
        uint64 _timeTx;
        uint64 start;
        uint64 end;
        uint128 _price;
        address wallet;
        uint8 status;
        address sender;
    }

    event DirectSellStateChanged(
        uint8 from, 
        uint8 to, 
        DirectSellDetails
    );

    event DirectSellDeployed(
        address _directSellAddress, 
        address sender, 
        address paymentToken, 
        address nft, 
        uint64 _nonce, 
        uint128 price
    );
    event DirectSellDeclined(address sender);

    function directSellDeployedCallback(
        address directSellAddress,
        address sender, 
        address paymentToken, 
        address nftAddress, 
        uint64 nonce, 
        uint128 price
    ) external;
    
    function directSellDeclinedCallback(address sender) external;    

    function directSellSuccessCallback(
        address oldOwner,
        address newOwner
    ) external;

    function directSellCancelledOnTimeCallback() external; 
}