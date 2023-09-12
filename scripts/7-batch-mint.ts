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

    const response = await prompts([
        {
            type: 'number',
            name: 'from',
            message: 'Get NFT from count (default 1)',
            initial: 1
        },
        {
            type: 'number',
            name: 'to',
            message: 'Get NFT to count (default 10)',
            initial: 10
        }
    ]);
    let mintAndSell = migration.loadContract('MintAndSell', 'MintAndSell');

    // batch mint nft
    logger.log("Batch mint nft");
    await locklift.transactions.waitFinalized(mintAndSell.methods.createItems({_fromId: response.from, _toId: response.to}).send({
        from: account.address,
        amount: new BigNumber(response.to).minus(response.from).plus(1).times(1.2).plus(1).shiftedBy(9).toString()
    }));

    // // drain gas
    // logger.log("Drain gas");
    // await locklift.transactions.waitFinalized(mintAndSell.methods.drainGas({}).send({
    //     from: account.address,
    //     amount: toNano(0.1)
    // }));
}

main()
.then(() => process.exit(0))
.catch(e => {
    console.log(e);
    process.exit(1);
});
