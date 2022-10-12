pragma ever-solidity >= 0.62.0;

import "../AuctionRootTip3.sol";

interface IAuctionRootCallback {
    
    function auctionTip3DeployedCallback(
        uint32 callbackId,
        address offerAddress, 
        AuctionRootTip3.MarketOffer offerInfo
    ) external;    
    
    function auctionTip3DeployedDeclined(
        uint32 callbackId,
        address nftOwner, 
        address dataAddress
    ) external;
    
}