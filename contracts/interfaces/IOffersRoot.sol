pragma ever-solidity >= 0.62.0;

interface IOffersRoot {
    
    function changeDeploymentFee(uint128 _value) external;

    function changeMarketFee(uint8 _value, uint8 _decimals) external;

}
