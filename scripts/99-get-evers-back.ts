import { Migration } from "./migration";

const ora = require('ora');
const migration = new Migration();

async function main() {
    // @ts-ignore
    const giverAddress = locklift.giver.giverContract.address;
    const signer = await locklift.keystore.getSigner("0");
    const account  = locklift.factory.getDeployedContract("Wallet", migration.load("Wallet", "Account1").address);
    
    const spinner = ora(`Swiping Temporary Admin: ${account.address} back to Giver ${giverAddress}`).start();
    spinner.text = 'Waiting for Bounces to Complete'

    await locklift.tracing.trace(account.methods.sendTransaction({
        dest: giverAddress,
        value: 0,
        bounce: false,
        flags: 128,
        payload: ""
    }).sendExternal({publicKey: signer?.publicKey as string}));

    spinner.stopAndPersist({text: 'Swipe Complete'})
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
