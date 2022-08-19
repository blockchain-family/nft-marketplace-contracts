import { isValidTonAddress, logContract } from "../test/utils_old";
import { Migration } from "./migration";

const migration = new Migration();

// @ts-check
const BigNumber = require('bignumber.js');

const ora = require('ora')
const prompts = require('prompts')

async function main() {
    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'Collection new owner address',
            validate: (value:string) => isValidTonAddress(value) ? true : 'Invalid Everscale address'
        }
    ])

    const signer = await locklift.keystore.getSigner("0");
    let accountFactory = locklift.factory.getAccountsFactory('Wallet');
    const acc = accountFactory.getAccount(migration.load("Wallet", "Account1").address,  (signer?.publicKey) as string);
    const collection = locklift.factory.getDeployedContract("Collection", migration.load("Collection", "Collection").address);

        if(response.owner) {
        await acc.runTarget(
            {
                contract: collection,
                value: locklift.utils.toNano(1)
            },
            (collectionOwner) => collectionOwner.methods.transferOwnership({
                newOwner: response.owner
            }),
        );

        console.log('Transfer ownership to: ' + response.owner)
    }

    // @ts-ignore
    await logContract(collection)
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
