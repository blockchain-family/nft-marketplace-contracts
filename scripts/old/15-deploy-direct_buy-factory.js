const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();
const prompts = require('prompts')

const {
    isValidTonAddress,
} = require(process.cwd() + '/test/utils')

async function main() {
    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'FactoryDirectBuy owner',
            validate: value => isValidTonAddress(value) || value === '' ? true : 'Invalid Everscale address'
        }
    ])

    const account = migration.load(await locklift.factory.getAccount('Wallet'), 'Account1');
    const FactoryDirectBuy = await locklift.factory.getContract('FactoryDirectBuy');
    const [keyPair] = await locklift.keys.getKeyPairs();

    const TokenWalletPlatform = await locklift.factory.getContract('TokenWalletPlatform', 'precompiled');
    const DirectBuy = await locklift.factory.getContract('DirectBuy');

    let factoryDirectBuy = await locklift.giver.deployContract({
        contract: FactoryDirectBuy,
        constructorParams: {
            _owner: account.address,
            sendGasTo: account.address
        },
        initParams: {
            nonce_: Math.random() * 6400 | 0,
            tokenPlatformCode: TokenWalletPlatform.code,  
            directBuyCode: DirectBuy.code
        },
        keyPair,
    }, locklift.utils.convertCrystal(10, 'nano'));

    console.log(`FactoryDirectBuy: ${factoryDirectBuy.address}`);
    migration.store(factoryDirectBuy, 'FactoryDirectBuy');

    if (response.owner) {
        await account.runTarget({
            contract: factoryDirectBuy,
            method: 'transferOwnership',
            params: {
                newOwner: response.owner
            },
            keyPair,
            value: locklift.utils.convertCrystal(1, 'nano')
        });
    }
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
