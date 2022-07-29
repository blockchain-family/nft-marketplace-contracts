import { Migration } from "./migration";
const { Command } = require('commander');
const program = new Command();

const migration = new Migration();

async function main() {
    const signer = (await locklift.keystore.getSigner("0"));

    program
        .allowUnknownOption()
        .option('-n, --key_number <key_number>', 'count of accounts')
        .option('-b, --balance <balance>', 'count of accounts')
        .parse(process.argv);

    const options = program.opts();

    const key_number = +(options.key_number || '0');
    const balance = +(options.balance || '10');

    const { contract: wallet, tx } = await locklift.factory.deployContract({
        contract: "Wallet",
        publicKey: signer.publicKey,
        initParams: {
            _randomNonce: locklift.utils.getRandomNonce(),
        },
        constructorParams: {},
        value: locklift.utils.toNano(balance),
    });

    const name = `Account${key_number + 1}`;
    
    migration.store(wallet, name);
    console.log(`${name}: ${wallet.address.toString()}`);

}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });