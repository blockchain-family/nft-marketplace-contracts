import { Migration } from "./migration";
import {toNano, WalletTypes} from "locklift";
const { Command } = require('commander');
const program = new Command();

const migration = new Migration();

async function main() {
    const signer = (await locklift.keystore.getSigner("0"))!;
    program
        .allowUnknownOption()
        .option('-n, --key_number <key_number>', 'count of accounts')
        .option('-b, --balance <balance>', 'count of accounts')
        .parse(process.argv);

    const options = program.opts();

    const key_number = +(options.key_number || '0');
    const balance = +(options.balance || '10');
    console.log(await locklift.provider.getBalance(locklift.giver));
    const account = await locklift.factory.accounts.addNewAccount({
      type: WalletTypes.WalletV3,
      value: toNano(balance),
      publicKey: signer.publicKey,
    });
    // let accountFactory = locklift.factory.getAccountsFactory(contractName);
    // const { account: wallet, tx } = await accountFactory.deployNewAccount({
    //     publicKey: (signer?.publicKey) as string,
    //     initParams: {
    //         _randomNonce: locklift.utils.getRandomNonce(),
    //     },
    //     constructorParams: {},
    //     value: locklift.utils.toNano(balance),
    // });

    const name = `Account${key_number + 1}`;
    migration.store(account.account.address, "Wallet", name);
    console.log(`${name}: ${account.account.address.toString()}`);
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });