import { isValidTonAddress} from "../test/utils_old";
import { Migration } from "./migration";

const migration = new Migration();
const ora = require('ora');
const prompts = require('prompts');
const BigNumber = require('bignumber.js');

async function main() {
    const response = await prompts([
        {
            type: 'text',
            name: 'to',
            message: 'To',
            validate: (value:string) => isValidTonAddress(value) || value === '' ? true : 'Invalid Everscale address'
        },
        {
            type: 'number',
            name: 'amount',
            message: 'Amount',
            initial: 1
        }
    ]) 
    
    const signer = await locklift.keystore.getSigner("0");
    const account = locklift.factory.getDeployedContract("Wallet", migration.load("Wallet", "Account1").address);
    
    const spinner = ora(`Send ${response.amount} EVER from ${account.address} to ${response.to}`).start();
    spinner.text = 'Waiting for Bounces to Complete'

    await locklift.tracing.trace(account.methods.sendTransaction({
        dest: response.to,
        value: new BigNumber(response.amount).shiftedBy(9).toString(),
        bounce: false,
        flags: 1,
        payload: ""
    }).sendExternal({publicKey: signer?.publicKey as string}));
    
    spinner.stopAndPersist({text: 'Complete'})
    
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
