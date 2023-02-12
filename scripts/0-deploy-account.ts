import { Migration } from "./migration";
const { Command } = require('commander');
const program = new Command();

const migration = new Migration();
import {getRandomNonce, toNano, WalletTypes} from "locklift";

async function main() {
    program
        .allowUnknownOption()
        .option('-n, --key_number <key_number>', 'count of accounts')
        .option('-b, --balance <balance>', 'count of accounts')
        .parse(process.argv);

    const options = program.opts();

    const key_number = +(options.key_number || '0');
    const balance = +(options.balance || '1');

    const signer = await locklift.keystore.getSigner(key_number.toString());
    const { account } = (await locklift.factory.accounts.addNewAccount({
        type: WalletTypes.EverWallet, // or WalletTypes.HighLoadWallet,
        //Value which will send to the new account from a giver
        value: toNano(balance),
        //owner publicKey
        publicKey: signer!.publicKey,
        nonce: getRandomNonce()
    }));

    await locklift.provider.sendMessage({
        sender: account.address,
        recipient: account.address,
        amount: toNano(0.1),
        bounce: false
    })

    const name = `Account${key_number + 1}`;
    migration.store(account, name);
    console.log(`${name}: ${account.address.toString()}`);
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
