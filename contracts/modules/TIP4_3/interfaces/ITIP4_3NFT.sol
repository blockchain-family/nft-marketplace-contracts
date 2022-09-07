pragma ever-solidity >= 0.62.0;

interface ITIP4_3NFT {
    
    function indexCode() external view responsible returns (TvmCell code);
    
    function indexCodeHash() external view responsible returns (uint256 hash);
    
    function resolveIndex(address collection, address owner) external view responsible returns (address index);

}