pragma ever-solidity >= 0.61.2;

import "../FactoryAuction.sol";

interface IAuctionRootCallback {
    
    function auctionTip3DeployedCallback(
        uint32 callbackId,
        address offer, 
        FactoryAuction.MarketOffer offerInfo
    ) external;    
    
    function auctionTip3DeployedDeclined(
        uint32 callbackId,
        address nftOwner, 
        address nft
    ) external;
    
}