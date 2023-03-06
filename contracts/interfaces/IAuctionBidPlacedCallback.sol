pragma ever-solidity >= 0.61.2;

interface IAuctionBidPlacedCallback {
    
    function bidPlacedCallback(
        uint32 callbackId,
        uint128 nextBidValue, 
        address nft
    ) external;
    
    function bidNotPlacedCallback(
        uint32 callbackId, 
        address nft
    ) external;
    
    function bidRaisedCallback(
        uint32 callbackId, 
        address newBidAddr, 
        uint128 newBidValue,
        address nft
    ) external;

    function auctionComplete(
        uint32 callbackId, 
        address nft
    ) external;

    function auctionCancelled(
        uint32 callbackId, 
        address nft
    ) external;
}   
