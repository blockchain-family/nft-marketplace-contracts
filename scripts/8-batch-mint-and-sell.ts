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
    const savedFactoryDirectSell = await migration.loadContract('FactoryDirectSell', 'FactoryDirectSell');

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
        },
        {
            type: 'text',
            name: 'factoryDirectSell',
            message: 'Get FactoryDirectSell address (default ' + savedFactoryDirectSell.address + ')',
            validate: (value: any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address',
            initial: savedFactoryDirectSell.address
        }
    ]);
    let mintAndSell = migration.loadContract('MintAndSell', 'MintAndSell');

    // batch mint nft
    logger.log("Batch mint nft");
    await locklift.tracing.trace(mintAndSell.methods.createItems({_fromId: response.from, _toId: response.to}).send({
        from: account.address,
        amount: new BigNumber(response.to).minus(response.from).plus(1).times(1.2).plus(1).shiftedBy(9).toString()
    }));

    const factoryDirectSell = await locklift.factory.getDeployedContract(
        "FactoryDirectSell",
        new Address(response.factoryDirectSell.toString())
    );
    const gas = (await factoryDirectSell.methods.getGasValue().call()).value0;
    const gasPrice = new BigNumber(1).shiftedBy(9).div(gas.gasK);
    let targetGas = new BigNumber(gas.sell.dynamicGas).times(gasPrice).plus(gas.sell.fixedValue).toNumber();

    //batch sell nft
    logger.log("Batch sell nft");
    await locklift.tracing.trace(mintAndSell.methods.sellItems({_fromId: response.from, _toId: response.to}).send({
        from: account.address,
        amount: new BigNumber(targetGas).shiftedBy(-9).plus(0.4).times(response.to - response.from + 1)
            .plus(1)
            .shiftedBy(9).toString()
    }));

    //drain gas
    logger.log("Drain gas");
    await locklift.tracing.trace(mintAndSell.methods.drainGas({}).send({
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