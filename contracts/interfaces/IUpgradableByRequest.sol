pragma ever-solidity >= 0.61.2;

interface IUpgradableByRequest {
    function upgrade(TvmCell code, uint32 newVersion, address sendGasTo) external;
}
