import { Migration } from "./migration";
import { Address } from "locklift";

const ora = require('ora');
const migration = new Migration();
const BigNumber = require('bignumber.js');

async function main() {
    const giverAddress = new Address(locklift.context.network.config.giver.address);
    const account = await migration.loadAccount('Account1');
    const walletBalance = await locklift.provider.getBalance(account.address);
    console.log('Balance:', Number(walletBalance));

    const spinner = ora(`Swiping Temporary Admin: ${account.address} back to Giver ${giverAddress}`).start();
    spinner.text = 'Waiting for Bounces to Complete';

    await locklift.provider.sendMessage({
        sender: account.address,
        recipient: giverAddress,
        amount: walletBalance,
        bounce: false
    });

    spinner.stopAndPersist({text: 'Swipe Complete'})
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
