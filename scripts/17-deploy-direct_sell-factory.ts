import { Migration } from "./migration";
import { isValidEverAddress} from "../test/utils";

const prompts = require('prompts');
const migration = new Migration();

async function main() {
    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'FactoryDirectSell owner',
            validate: (value:any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address'    
        }
    ]);

    const account = migration.load("Wallet", "Account1");
    const signer = (await locklift.keystore.getSigner('0'));
    const accountFactory = locklift.factory.getAccountsFactory("Wallet");
    const acc = accountFactory.getAccount(account.address, (signer?.publicKey) as string);
    const {contract: factoryDirectSell, tx } = await locklift.factory.deployContract({
        contract: "FactoryDirectSell",
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _owner: account.address,
            sendGasTo: account.address
        },
        initParams: {
            nonce_: Math.random() * 6400 | 0
        },
        value: locklift.utils.toNano(10)
    });

    console.log(`FactoryDirectSell: ${factoryDirectSell.address}`);
    migration.store(factoryDirectSell.address, "FactoryDirectSell", "FactoryDirectSell");
    const DirectSell = (await locklift.factory.getContractArtifacts('DirectSell'));

    console.log(`Set code DirectSell`);
    await acc.runTarget(
        {
            contract:factoryDirectSell,
            value: locklift.utils.toNano(1),
        },
        (dS) => dS.methods.setCodeDirectSell({
            _directSellCode: DirectSell.code,
        }),
    );

    if (response.owner) {
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
