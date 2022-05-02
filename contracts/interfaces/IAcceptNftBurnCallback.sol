pragma ton-solidity >=0.57.1;

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
