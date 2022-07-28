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
            message: 'FactoryDirectSell owner',
            validate: value => isValidTonAddress(value) || value === '' ? true : 'Invalid Everscale address'    
        }
    ])

    const account = migration.load(await locklift.factory.getAccount('Wallet'), 'Account1');
    const FactoryDirectSell = await locklift.factory.getContract('FactoryDirectSell');
    const [keyPair] = await locklift.keys.getKeyPairs();

    const DirectSell = await locklift.factory.getContract('DirectSell');

    let factoryDirectSell = await locklift.giver.deployContract({
        contract: FactoryDirectSell,
        constructorParams: {
            _owner: account.address,
            sendGasTo: account.address
        },
        initParams: {
            nonce_: Math.random() * 6400 | 0,
            directSellCode: DirectSell.code
        }, 
        keyPair,
    }, locklift.utils.convertCrystal(10, 'nano'));

    console.log(`FactoryDirectSell: ${factoryDirectSell.address}`);

    migration.store(factoryDirectSell, 'FactoryDirectSell');

    if (response.owner) {
        await account.runTarget({
            contract: factoryDirectSell,
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
