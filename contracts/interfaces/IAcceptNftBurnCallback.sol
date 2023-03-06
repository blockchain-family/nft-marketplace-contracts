pragma ever-solidity >= 0.61.2;

interface IAcceptNftBurnCallback {
    
    function onAcceptNftBurn(
        address _collection,
        uint256 _id,
        address _nft,
        address _owner,
        address _manager,
        address _remainingGasTo,
        TvmCell _payload
    ) external;
    
}
