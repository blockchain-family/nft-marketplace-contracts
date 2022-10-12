
export class NftAuctionCallbacks {
    static Callbacks = {
        'ABI version': 2,
        header: ['time'],
        "functions": [
            {
                name: 'auctionTip3DeployedCallback',
                inputs: [
                    { name: 'callbackId', type: 'uint32' },
                    { name: 'offerAddress', type: 'address' },
                    { name: 'offerInfo',
                      components: [
                        { name: 'collection', type: 'address'},
                        { name: 'nftOwner', type: 'address'},
                        { name: 'nft', type: 'address'},
                        { name: 'offer', type: 'address'},
                        { name: 'price', type: 'uint128'},
                        { name: 'auctionDuration', type: 'uint128'},
                        { name: 'deployNonce', type: 'uint64'},
                    ],
                    type: 'tuple'},
                ],
                outputs: [],
            },
            {
                name: 'auctionTip3DeployedDeclined',
                inputs: [
                    { name: 'callbackId', type: 'uint32' },
                    { name: 'nftOwner', type: 'address' },
                    { name: 'dataAddress', type: 'address' },
                ],
                outputs: [],
            },
            {
                name: 'bidPlacedCallback',
                inputs: [
                    { name: 'callbackId', type: 'uint32' },
                    { name: 'nextBidValue', type: 'uint128' }
                ],
                outputs: [],
            },
            {
                name: 'bidNotPlacedCallback', 
                inputs: [{ name: 'callbackId', type: 'uint32' }],
                outputs: [],
            },
            {
                name: 'bidRaisedCallback',
                inputs: [
                    { name: 'callbackId', type: 'uint32' },
                    { name: 'newBidAddr', type: 'address' },
                    { name: 'newBidValue', type: 'uint128' },
                ],
                outputs: [],
            },
            {
                name: 'changeDeploymentFee',
                inputs: [{ name: '_value', type: 'uint128' }],
                outputs: [],
            },
            {
                name: 'changeMarketFee',
                inputs: [
                    { name: '_value', type: 'uint8' },
                    { name: '_decimals', type: 'uint8' },
                ],
                outputs: [],
            },
            {
                name: 'directBuyDeployed',
                inputs: [
                    { name: 'callbackId', type: 'uint32' },
                    { name: 'directBuyAddress', type: 'address' },
                    { name: 'sender', type: 'address' },
                    { name: 'token', type: 'address' },
                    { name: 'nft', type: 'address' },
                    { name: 'nonce', type: 'uint64' },
                    { name: 'amount', type: 'uint128' },
                ],
                outputs: [],
            },
            {
                name: 'directBuyDeployedDeclined',
                inputs: [
                    { name: 'callbackId', type: 'uint32' },
                    { name: 'sender', type: 'address' },
                    { name: 'token', type: 'address' },
                    { name: 'amount', type: 'uint128' },
                ],
                outputs: [],
            },
            {
                name: 'directBuySuccess',
                inputs: [
                    { name: 'callbackId', type: 'uint32' },
                    { name: 'oldOwner', type: 'address' },
                    { name: 'newOwner', type: 'address' },
                ],
                outputs: [],
            },
            {
                name: 'directBuyCancelledOnTime',
                inputs: [
                    { name: 'callbackId', type: 'uint32' },
                ],
                outputs: [],
            },
            {
                name: 'directSellDeployed',
                inputs: [
                    { name: 'callbackId', type: 'uint32' },
                    { name: 'directSellAddress', type: 'address' },
                    { name: 'sender', type: 'address' },
                    { name: 'paymentToken', type: 'address' },
                    { name: 'nftAddress', type: 'address' },
                    { name: 'nonce', type: 'uint64' },
                    { name: 'amount', type: 'uint128' },
                ],
                outputs: [],
            },
            {
                name: 'directSellDeclined',
                inputs: [
                    { name: 'callbackId', type: 'uint32' },
                    { name: 'sender', type: 'address' },
                ],
                outputs: [],
            },
            {
                name: 'directSellSuccess',
                inputs: [
                    { name: 'callbackId', type: 'uint32' },
                    { name: 'oldOwner', type: 'address' },
                    { name: 'newOwner', type: 'address' },
                ],
                outputs: [],
            },
            {
                name: 'directSellCancelledOnTime',
                inputs: [
                    { name: 'callbackId', type: 'uint32' },
                ],
                outputs: [],
            }
        ],
        data: [],
        events: [],
    } as const
}