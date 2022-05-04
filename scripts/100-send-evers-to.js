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
            name: 'to',
            message: 'To',
            validate: value => isValidTonAddress(value) || value === '' ? true : 'Invalid Everscale address'
        },
        {
            type: 'number',
            name: 'amount',
            message: 'Amount',
            initial: 1
        }
    ])

    const [keyPair] = await locklift.keys.getKeyPairs();
    const tempAdmin = await locklift.factory.getAccount("Wallet");
    migration.load(tempAdmin, 'Account')

    const giverAddress = locklift.giver.giver.address;
    const spinner = ora(`Send ${response.amount} EVER from ${tempAdmin.address} to ${response.to}`).start();

    await new Promise(r => setTimeout(r, 10000))
    spinner.text = 'Waiting for Bounces to Complete'

    await tempAdmin.run({
        method: 'sendTransaction',
        params: {
            dest: response.to,
            value: new BigNumber(response.amount).shiftedBy(9),
            bounce: false,
            flags: 1,
            payload: ''
        },
        keyPair
    });

    spinner.stopAndPersist({text: 'Complete'})
}


main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
