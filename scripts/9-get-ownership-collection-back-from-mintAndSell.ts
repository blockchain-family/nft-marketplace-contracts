import { isValidEverAddress} from "../test/utils";
import { Migration } from "./migration";
import {toNano} from "locklift";
import {Address} from "everscale-inpage-provider";
import {FactoryDirectSell} from "../test/wrappers/DirectSell";

const migration = new Migration();
const BigNumber = require('bignumber.js');
const fs = require('fs');
const prompts = require('prompts');
const logger = require("mocha-logger");

async function main() {
    const signer = (await locklift.keystore.getSigner('0'));
    const account = await migration.loadAccount('Account1');
    const savedMintAndSell = migration.loadContract('MintAndSell', 'MintAndSell');

    const response = await prompts([
        {
            type: 'text',
            name: 'mintAndSell',
            message: 'Get mintAndSell address (default ' + savedMintAndSell.address + ')',
            validate: (value: any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address',
            initial: savedMintAndSell.address
        },
        {
            type: 'text',
            name: 'owner',
            message: 'Get new owner address for collection (default ' + account.address + ')',
            validate: (value: any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address',
            initial: account.address
        }
    ]);

    const MintAndSell = await locklift.factory.getDeployedContract(
        "MintAndSell",
        new Address(response.mintAndSell.toString())
    );

    // get collection ownership back
    logger.log("get collection ownership back");
    await locklift.tracing.trace(MintAndSell.methods.getCollectionOwnershipBack({newOwner: savedMintAndSell}).send({
        from: account.address,
        amount: toNano(3)
    }));

    //drain gas
    logger.log("Drain gas");
    await locklift.tracing.trace(MintAndSell.methods.drainGas({}).send({
        from: account.address,
        amount: toNano(0.1)
    }));
}

main()
.then(() => process.exit(0))
.catch(e => {
    console.log(e);
    process.exit(1);
});