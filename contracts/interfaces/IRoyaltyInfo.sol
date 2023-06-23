pragma ever-solidity >= 0.61.2;

interface IRoyaltyInfo {
    /// @notice NFT royalty information
    /// @param salePrice the sale price of the NFT
    /// @return receiver address of who should be sent the royalty payment
    /// @return currentRoyalty - the royalty payment amount for salePrice
    function royaltyInfo(uint128 salePrice) external view responsible returns(address receiver, uint128 currentRoyalty);
}