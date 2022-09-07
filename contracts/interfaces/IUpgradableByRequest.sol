pragma ever-solidity >= 0.62.0;

interface IUpgradableByRequest {
    function upgrade(TvmCell code, uint32 newVersion, address sendGasTo) external;
}
