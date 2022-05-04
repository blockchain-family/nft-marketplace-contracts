// @ts-check
const BigNumber = require('bignumber.js');

const ora = require('ora')
const prompts = require('prompts')

const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();

const {
    deployCollection,
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

const INCREMENT = 20;

/** @type {LockLift} */
var locklift = global.locklift;

async function main() {

    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'Collection new owner address',
            validate: value => isValidTonAddress(value) ? true : 'Invalid Everscale address'
        }
    ])


    const [keyPair] = await locklift.keys.getKeyPairs();
    const account = await locklift.factory.getAccount("Wallet");
    migration.load(account, 'Account')
    const collection = await locklift.factory.getContract("Collection")
    migration.load(collection, 'Collection')

    if (response.owner) {
        await account.runTarget({
            contract: collection,
            method: 'transferOwnership',
            params: {
                newOwner: response.owner
            },
            keyPair,
            value: locklift.utils.convertCrystal(1, 'nano')
        })
    }
    console.log('Transfer ownership to: ' + response.owner)

    await logContract(collection)

}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
