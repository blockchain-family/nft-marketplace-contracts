pragma ton-solidity >= 0.57.1;

interface IIndex {
    function getInfo() external view responsible returns (
        address collection,
        address owner,
        address nft
    );
    function destruct(address gasReceiver) external;
}