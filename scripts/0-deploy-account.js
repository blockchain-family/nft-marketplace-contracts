// @ts-check
const prompts = require('prompts')

const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();

const {deployAccount, LockLift} = require( process.cwd() + '/test/utils.ts')

/** @type {LockLift} */
var locklift = global.locklift;

async function main() {
    const [keyPair] = await locklift.keys.getKeyPairs();

    const response = await prompts([
        {
            type: 'number',
            name: 'amount',
            message: 'Amount of Ever for Admin',
            initial: 1
        }
    ])

    let temp = await deployAccount(keyPair, response.amount)
    migration.store(temp, 'Account');
    console.log('TempAccount', temp.address)
    console.log(`Sent ${response.amount} Ever to Account: ${temp.address}`)
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
