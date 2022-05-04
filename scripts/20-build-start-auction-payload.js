const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();

const BigNumber = require('bignumber.js');

async function main() {

    const account = await locklift.factory.getAccount("Wallet");
    migration.load(account, 'Account')
    const AuctionRootTip3 = await locklift.factory.getContract('AuctionRootTip3');
    migration.load(AuctionRootTip3, 'AuctionRootTip3')

    const payload1 = await AuctionRootTip3.call({
        method: 'buildAuctionCreationPayload',
        params: {
            _paymentTokenRoot: '0:a49cd4e158a9a15555e624759e2e4e766d22600b7800d891e46f9291f044a93d',
            _price: 1000000,
            _auctionStartTime: new BigNumber(new Date().getTime()).div(1000).dp(0).plus(120).toFixed(),
            _auctionDuration: 86400
        },
    })


    const Nft = await locklift.factory.getContract("Nft");

    // const callbacks = [
    //     [AuctionRootTip3.address, { value: new BigNumber(5).shiftedBy(9).toFixed(), payload: payload1}]
    // ];

    const callbacks = {};
    callbacks[AuctionRootTip3.address] = { value: new BigNumber(5).shiftedBy(9).toFixed(), payload: payload1};

    const message = await this.locklift.ton.client.abi.encode_message_body({
        abi: {
            type: "Contract",
            value: Nft.abi,
        },
        call_set: {
            function_name: 'changeManager',
            input: {
                newManager: AuctionRootTip3.address,
                sendGasTo: account.address,
                callbacks
            },
        },
        signer: {
            type: 'None',
        },
        is_internal: true,
    });

    console.log(message.body);

}


main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
