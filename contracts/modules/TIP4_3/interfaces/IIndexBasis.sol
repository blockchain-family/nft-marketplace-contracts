pragma ton-solidity >= 0.57.1;

interface IIndexBasis {
    function getInfo() external view responsible returns (address collection);
    function destruct(address gasReceiver) external;
}