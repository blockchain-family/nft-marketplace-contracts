pragma ton-solidity >=0.57.1;

interface IAuctionBidPlacedCallback {
    function bidPlacedCallback(uint32 callbackId) external;
    function bidNotPlacedCallback(uint32 callbackId) external;
}
