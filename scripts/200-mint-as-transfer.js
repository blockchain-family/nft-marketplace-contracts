const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();

async function main() {
    const [keyPair] = await locklift.keys.getKeyPairs();

    const MintAsTransfer = await locklift.factory.getContract('MintAsTransfer');
    let mintAsTransfer = await locklift.giver.deployContract({
        contract: MintAsTransfer,
        constructorParams: {},
        initParams: {
            nonce_: Math.random() * 6400 | 0,
        },
        keyPair,
    }, locklift.utils.convertCrystal(2, 'nano'));

    console.log('MintAsTransfer', mintAsTransfer.address)
    migration.store(mintAsTransfer, 'MintAsTransfer');
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
