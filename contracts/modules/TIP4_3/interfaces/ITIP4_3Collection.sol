pragma ever-solidity >= 0.61.2;

interface ITIP4_3Collection {
    
    function indexBasisCode() external view responsible returns (TvmCell code);
    
    function indexBasisCodeHash() external view responsible returns (uint256 hash);
    
    function indexCode() external view responsible returns (TvmCell code);
    
    function indexCodeHash() external view responsible returns (uint256 hash);
    
    function resolveIndexBasis() external view responsible returns (address indexBasis);
    
}