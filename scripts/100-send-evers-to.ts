import {Address, WalletTypes} from "locklift/.";
import { Migration } from "./migration";
import { isValidEverAddress } from "../test/utils";

const migration = new Migration();
const ora = require('ora');
const prompts = require('prompts');
const BigNumber = require('bignumber.js');

async function main() {
    let account = await migration.loadAccount('Account1');

    const response = await prompts([
        {
            type: 'text',
            name: 'from',
            message: 'From',
            validate: (value: string) => isValidEverAddress(value) ? true : 'Invalid Everscale address' || value === '' ? account.address.toString() : value,
            initial: account.address.toString()
        },
        {
            type: 'text',
            name: 'to',
            message: 'To',
            validate: (value: string) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address'
        },
        {
            type: 'number',
            name: 'amount',
            message: 'Amount',
            initial: 1
        }
    ]);

    if (response.from) {
        account = await locklift.factory.accounts.addExistingAccount({
            type: WalletTypes.EverWallet,
            address: new Address(response.from)
        });
    }

    const spinner = ora(`Send ${response.amount} EVER from ${account.address} to ${response.to}`).start();
    spinner.text = 'Waiting for Bounces to Complete'

    await locklift.provider.sendMessage({
      sender: account.address,
      recipient: response.to,
      amount: new BigNumber(response.amount).shiftedBy(9).toString(),
      bounce: false
    });

    spinner.stopAndPersist({text: 'Complete'});
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
