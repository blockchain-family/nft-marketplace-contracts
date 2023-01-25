pragma ever-solidity >= 0.61.2;


library ExchangePayload {
    
    function getSenderAndCallId(
        address _sender,
        TvmCell _payload
    ) public returns (address, uint32) {
        // Set default values for sender and ID
        uint32 callbackId = 0;
        address buyer = _sender;

        TvmSlice payloadSlice = _payload.toSlice();

        if (payloadSlice.bits() >= 32) {
            callbackId = payloadSlice.decode(uint32);
            if (payloadSlice.bits() >= 267) {
                buyer = payloadSlice.decode(address);
            }
        }

        return (buyer, callbackId);
    }

}