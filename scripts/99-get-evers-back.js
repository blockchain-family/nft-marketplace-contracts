const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();

async function main() {

    const [keyPair] = await locklift.keys.getKeyPairs();
    const tempAdmin = await locklift.factory.getAccount("Wallet");
    migration.load(tempAdmin, 'Account')

    const giverAddress = locklift.giver.giver.address;
    const spinner = ora(`Swiping Temporary Admin: ${tempAdmin.address} back to Giver ${giverAddress}`).start();

    await new Promise(r => setTimeout(r, 10000))
    spinner.text = 'Waiting for Bounces to Complete'

    await tempAdmin.run({
        method: 'sendTransaction',
        params: {
            dest: giverAddress,
            value: 0,
            bounce: false,
            flags: 128,
            payload: ''
        },
        keyPair
    });

    spinner.stopAndPersist({text: 'Swipe Complete'})
}


main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
