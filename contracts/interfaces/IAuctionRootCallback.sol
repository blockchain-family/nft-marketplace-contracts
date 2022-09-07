pragma ever-solidity >= 0.62.0;

import "../AuctionRootTip3.sol";

interface IAuctionRootCallback {
    
    function auctionTip3DeployedCallback(
        address offerAddress, 
        AuctionRootTip3.MarketOffer offerInfo
    ) external;    
    
    function auctionTip3DeployedDeclined(
        address nftOwner, 
        address dataAddress
    ) external;
    
}