import { Migration } from "./migration";
import { isValidEverAddress} from "../test/utils";

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
    const account = await migration.loadAccount('Account1');
    const collection = migration.loadContract("Collection", "Collection");

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
