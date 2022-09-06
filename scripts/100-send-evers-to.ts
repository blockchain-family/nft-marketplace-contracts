import { Address } from "locklift/.";
import { isValidTonAddress} from "../test/utils";
import { Migration } from "./migration";

const migration = new Migration();
const ora = require('ora');
const prompts = require('prompts');
const BigNumber = require('bignumber.js');

async function main() {
    const signer = await locklift.keystore.getSigner('0');
    let account = locklift.factory.getDeployedContract("Wallet", migration.load("Wallet", "Account1").address);
    
    const response = await prompts([
        {
            type: 'from',
            name: 'from',
            message: 'From',
            validate: (value: string) => isValidTonAddress(value) ? true : 'Invalid Everscale address' || value === '' ? account.address.toString() : value 
        },
        {
            type: 'text',
            name: 'to',
            message: 'To',
            validate: (value: string) => isValidTonAddress(value) || value === '' ? true : 'Invalid Everscale address'
        },
        {
            type: 'number',
            name: 'amount',
            message: 'Amount',
            initial: 1
        }
    ]);

    if (response.from) {
        account = locklift.factory.getDeployedContract("Wallet", new Address(response.from));
    }
    
    const spinner = ora(`Send ${response.amount} EVER from ${account.address} to ${response.to}`).start();
    spinner.text = 'Waiting for Bounces to Complete'

    await locklift.tracing.trace(account.methods.sendTransaction({
        dest: response.to,
        value: new BigNumber(response.amount).shiftedBy(9).toString(),
        bounce: false,
        flags: 1,
        payload: ""
    }).sendExternal({publicKey: signer?.publicKey as string}));
    
    spinner.stopAndPersist({text: 'Complete'}); 
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
