pragma ever-solidity ^0.61.2;

interface IRoyaltyInfo {
    /// @notice NFT royalty information
    /// @param salePrice the sale price of the NFT
    /// @return receiver address of who should be sent the royalty payment
    /// @return royaltyAmount - the royalty payment amount for salePrice
    /// The TIP-6.1 identifier for this interface is 0x60970214.
    function royaltyInfo(uint128 salePrice) external view responsible returns(address receiver, uint128 royaltyAmount);
}