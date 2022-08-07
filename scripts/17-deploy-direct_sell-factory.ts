import { Migration } from "./migration";

const prompts = require('prompts');
const migration = new Migration();
const {isValidTonAddress} = require(process.cwd() + '/test/utils');

async function main() {
    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'FactoryDirectSell owner',
            validate: value => isValidTonAddress(value) || value === '' ? true : 'Invalid Everscale address'    
        }
    ]);

    const account = migration.load("Wallet", "Account1");
    const signer = (await locklift.keystore.getSigner('0'));
    const DirectSell = (await locklift.factory.getContractArtifacts("DirectSell"));
    
    const {contract: factoryDirectSell, tx } = await locklift.factory.deployContract({
        contract: "FactoryDirectSell",
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _owner: account.address,
            sendGasTo: account.address
        },
        initParams: {
            nonce_: Math.random() * 6400 | 0,
            directSellCode: DirectSell.code
        },
        value: locklift.utils.toNano(10)
    });

    console.log(`FactoryDirectSell: ${factoryDirectSell.address}`);
    migration.store(factoryDirectSell.address, "FactoryDirectSell", "FactoryDirectSell");

    if (response.owner) {
        const accountFactory = locklift.factory.getAccountsFactory("Wallet");
        const acc = accountFactory.getAccount(account.address, (signer?.publicKey) as string);
        await acc.runTarget(
            {
                contract: factoryDirectSell,
                value: locklift.utils.toNano(1),
            },
            (directSell) => directSell.methods.transferOwnership({
                newOwner: response.owner
            }),
        );
    }
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
