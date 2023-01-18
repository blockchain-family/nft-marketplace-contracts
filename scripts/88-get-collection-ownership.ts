import { Migration } from "./migration";
import { isValidEverAddress} from "../test/utils";
import {WalletTypes} from "locklift";

const migration = new Migration();
const prompts = require('prompts')

async function main() {
    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'Collection new owner address',
            validate: (value:string) => isValidEverAddress(value) ? true : 'Invalid Everscale address'
        }
    ])
    const account = await locklift.factory.accounts.addExistingAccount({
        type: WalletTypes.EverWallet,
        address: migration.getAddress('Account1')
    });
    const collection = locklift.factory.getDeployedContract("Collection", migration.load("Collection", "Collection").address);

    if(response.owner) {
        await collection.methods.transferOwnership({
                newOwner: response.owner
            }).send({
                from: account.address,
                amount: locklift.utils.toNano(1)
            });
        console.log('Transfer ownership to: ' + response.owner)
    }
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
