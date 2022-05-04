const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();

const BigNumber = require('bignumber.js');

const ora = require('ora')
const prompts = require('prompts')

const {
    deployMarket,
    deployAccount,
    deployTokenRoot,
    getAccount,
    Contract,
    LockLift,
    getRandomNonce,
    isValidTonAddress,
    logContract,
    getTotalSupply
} = require(process.cwd() + '/test/utils')

async function main() {

    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'Owner',
            validate: value => isValidTonAddress(value) || value === '' ? true : 'Invalid Everscale address'
        }
    ])

    const account = migration.load(await locklift.factory.getAccount('Wallet'), 'Account');
    const AuctionRootTip3 = await locklift.factory.getContract('AuctionRootTip3');
    const [keyPair] = await locklift.keys.getKeyPairs();

    const Nft = await locklift.factory.getContract('Nft');

    const AuctionTip3 = await locklift.factory.getContract('AuctionTip3');
    let auctionRootTip3 = await locklift.giver.deployContract({
        contract: AuctionRootTip3,
        constructorParams: {
            _codeNft: Nft.code,
            _owner: account.address,
            _offerCode: AuctionTip3.code,
            _deploymentFee: 0,
            _marketFee: 0,
            _marketFeeDecimals: 0,
            _auctionBidDelta: 100, // ???
            _auctionBidDeltaDecimals: 1, // ???
            _sendGasTo: account.address
        },
        initParams: {
            nonce_: Math.random() * 6400 | 0,
        },
        keyPair,
    }, locklift.utils.convertCrystal(10, 'nano'));

    console.log(`Account: ${account.address}`)
    console.log(`AuctionRootTip3: ${auctionRootTip3.address}`)

    migration.store(auctionRootTip3, 'AuctionRootTip3');

    if (response.owner) {
        await account.runTarget({
            contract: auctionRootTip3,
            method: 'transferOwnership',
            params: {
                newOwner: response.owner
            },
            keyPair,
            value: locklift.utils.convertCrystal(1, 'nano')
        })
    }
}


main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
