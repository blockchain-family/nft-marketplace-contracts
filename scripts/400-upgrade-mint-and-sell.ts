import { isValidEverAddress} from "../test/utils";
import { Migration } from "./migration";
import {toNano} from "locklift";
import {Address} from "everscale-inpage-provider";
import {FactoryDirectSell} from "../test/wrappers/directSell";

const migration = new Migration();
const BigNumber = require('bignumber.js');
const fs = require('fs');
const prompts = require('prompts');
const logger = require("mocha-logger");

async function main() {
    const signer = (await locklift.keystore.getSigner('0'));
    const account = await migration.loadAccount('Account1');
    const savedMintAndSell = migration.loadContract('MintAndSell', 'MintAndSell');

    const New = (await locklift.factory.getContractArtifacts("MintAndSell"));

    await locklift.transactions.waitFinalized(savedMintAndSell.methods.upgrade({
        newCode: New.code,
        sendGasTo: account.address,
    }).send({
        from: account.address,
        amount: toNano(5)
    }));

    await locklift.transactions.waitFinalized(savedMintAndSell.methods.setCollectionAddress({
        _collection: new Address('0:33a630f9c54fc4092f43ab978f3fd65964bb0d775553c16953aa1568eb63ab0f')
    }).send({
        from: account.address,
        amount: toNano(1)
    }));
}

main()
.then(() => process.exit(0))
.catch(e => {
    console.log(e);
    process.exit(1);
});
