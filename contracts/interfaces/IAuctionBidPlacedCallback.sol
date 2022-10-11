pragma ever-solidity >= 0.62.0;

interface IAuctionBidPlacedCallback {
    
    function bidPlacedCallback(uint32 callbackId, uint128 nextBidValue) external;
    
    function bidNotPlacedCallback(uint32 callbackId) external;
    
    function bidRaisedCallback(
        uint32 callbackId, 
        address newBidAddr, 
        uint128 newBidValue
    ) external;
    
}
