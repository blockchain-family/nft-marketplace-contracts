pragma ever-solidity >= 0.62.0;

interface ITIP4_1Collection {

    /// @notice This event emits when NFTs are created
    /// @param id Unique NFT id
    /// @param nft Address NFT contact
    /// @param owner Address of NFT owner
    /// @param manager Address of NFT manager
    /// @param creator Address of creator that initialize mint NFT
    event NftCreated(uint256 id, address nft, address owner, address manager, address creator);

    /// @notice This event emits when NFTs are burned
    /// @param id Unique NFT id
    /// @param nft Address NFT contact
    /// @param owner Address of NFT owner when it burned
    /// @param manager Address of NFT manager when it burned
    event NftBurned(uint256 id, address nft, address owner, address manager);


    /// @notice Count active NFTs for this collection
    /// @return count A count of active NFTs minted by this contract except for burned NFTs
    function totalSupply() external view responsible returns (uint128 count);

    /// @notice Returns the NFT code
    /// @return code Returns the NFT code as TvmCell
    function nftCode() external view responsible returns (TvmCell code);

    /// @notice Returns the NFT code hash
    /// @return codeHash Returns the NFT code hash
    function nftCodeHash() external view responsible returns (uint256 codeHash);

    /// @notice Computes NFT address by unique NFT id
    /// @dev Return unique address for all Ids. You find nothing by address for not a valid NFT.
    /// @param id Unique NFT id
    /// @return nft Returns address of NFT contract
    function nftAddress(uint256 id) external view responsible returns (address nft);
}