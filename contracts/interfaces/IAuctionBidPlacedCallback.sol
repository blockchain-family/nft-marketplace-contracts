pragma ton-solidity >= 0.62.0;

interface IAuctionBidPlacedCallback {
    function bidPlacedCallback(uint32 callbackId) external;
    function bidNotPlacedCallback(uint32 callbackId) external;
}
