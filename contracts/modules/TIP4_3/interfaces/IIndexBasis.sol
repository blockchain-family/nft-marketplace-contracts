pragma ever-solidity >= 0.62.0;

interface IIndexBasis {
   
    function getInfo() external view responsible returns (address collection);
    
    function destruct(address gasReceiver) external;

}