pragma ever-solidity >= 0.61.2;

interface IIndexBasis {
   
    function getInfo() external view responsible returns (address collection);
    
    function destruct(address gasReceiver) external;

}