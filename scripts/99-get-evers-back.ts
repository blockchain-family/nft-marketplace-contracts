import { Migration } from "./migration";
import {WalletTypes} from "locklift";

const ora = require('ora');
const migration = new Migration();
const BigNumber = require('bignumber.js');

async function main() {
    // @ts-ignore
    const giverAddress = locklift.giver.giverContract.address;
    const signer = await locklift.keystore.getSigner("0");
    let account = await locklift.factory.accounts.addExistingAccount({
        type: WalletTypes.EverWallet,
        address: migration.getAddress('Account1')
    });
    const walletBalance = await locklift.provider.getBalance(account.address);
    console.log('Balance:', Number(walletBalance));

    const spinner = ora(`Swiping Temporary Admin: ${account.address} back to Giver ${giverAddress}`).start();
    spinner.text = 'Waiting for Bounces to Complete';

    await locklift.provider.sendMessage({
        sender: account.address,
        recipient: giverAddress,
        amount: new BigNumber(walletBalance).shiftedBy(9).toString(),
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
