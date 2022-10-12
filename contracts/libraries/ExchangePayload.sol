pragma ever-solidity >= 0.62.0;

import "@broxus/credit-processor/contracts/libraries/EventDataDecoder.sol";
import "@broxus/credit-processor/contracts/interfaces/structures/ICreditEventDataStructure.sol";

library ExchangePayload {
    
    function getSenderAndCallId(
        address _sender,
        TvmCell _payload
    ) public returns (address, uint32) {
        // Set default values for sender and ID
        uint32 id;
        address user = _sender;

        // Is payload from a bridge?
        if (EventDataDecoder.isValid(_payload)) {
            // Decode data from bridge
            ICreditEventDataStructure.CreditEventData data = EventDataDecoder.decode(_payload);
            TvmSlice layer3Slice = data.layer3.toSlice();

            // Set sender
            user = data.user;

            // Check layer 3 size and decode id
            if (layer3Slice.bits() >= 32) {
                id = layer3Slice.decode(uint32);
            }
        } else {
            TvmSlice payloadSlice = _payload.toSlice();

            // Check payload size and decode id
            if (payloadSlice.bits() >= 32) {
                id = payloadSlice.decode(uint32);
            }
        }

        return (user, id);
    }

}