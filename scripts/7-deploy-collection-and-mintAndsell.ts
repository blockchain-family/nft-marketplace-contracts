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


let collection_json: any;
let patterns: any[] = [];

async function main() {
    const signer = (await locklift.keystore.getSigner('0'));
    const account = await migration.loadAccount('Account1');

    const savedFactoryDirectSell = await migration.loadContract('FactoryDirectSell', 'FactoryDirectSell');

    const response = await prompts([
        {
            type: 'text',
            name: 'nftOwner',
            message: 'Get NFT Owner Address - recipient (default ' + account.address + ')',
            validate: (value: any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address',
            initial: account.address
        },
        {
            type: 'text',
            name: 'factoryDirectSell',
            message: 'Get FactoryDirectSell address (default ' + savedFactoryDirectSell.address + ')',
            validate: (value: any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address',
            initial: savedFactoryDirectSell.address
        },
        {
            type: 'text',
            name: 'tokenRoot',
            message: 'Get tokenRoot address',
            validate: (value: any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address',
        }
    ]);

    const data = fs.readFileSync("collection4.json", 'utf8');
    if (data) collection_json = JSON.parse(data);

    // deploy collection
    logger.log("Deploy collection");
    const Nft = (await locklift.factory.getContractArtifacts("Nft"));
    const Index = (await locklift.factory.getContractArtifacts("Index"));
    const IndexBasis = (await locklift.factory.getContractArtifacts("IndexBasis"));

    if (collection_json.nfts) {
        for (let nft of collection_json.nfts) {
            patterns.push(
                {
                    name: nft.name,
                    description: nft.description,
                    previewUrl: nft.preview_url,
                    previewMimeType: nft.previewMimeType,
                    fileUrl: nft.url,
                    fileMimeType: nft.fileMimeType,
                    externalUrl: nft.externalUrl,
                    attributes: nft.attributes
                }
            );
        }
    }

    const collection = (await locklift.factory.deployContract({
        contract: "CollectionSimilar",
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            codeNft: Nft.code,
            codeIndex: Index.code,
            codeIndexBasis: IndexBasis.code,
            owner: account.address,
            remainOnNft: toNano(0.3),
            json: JSON.stringify(collection_json.collection),
            patterns: patterns,
        },
        initParams: {
            nonce_: locklift.utils.getRandomNonce()
        },
        value: toNano(5)
    })).contract;
    logger.success(`Collection: ${collection.address}`);

    migration.store(collection, "SimilarCollection");

    const factoryDirectSell = await locklift.factory.getDeployedContract(
        "FactoryDirectSell",
        new Address(response.factoryDirectSell.toString())
    );
    const gas = (await factoryDirectSell.methods.getGasValue().call()).value0;
    const gasPrice = new BigNumber(1).shiftedBy(9).div(gas.gasK);
    let targetGas = new BigNumber(gas.sell.dynamicGas).times(gasPrice).plus(gas.sell.fixedValue).toNumber();

    // build payload for directSell
    logger.log("Build payload");
    const targetPayload = (await factoryDirectSell.methods.buildDirectSellCreationPayload({
        callbackId: 0,
        _startTime: Math.round(Date.now() / 1000),
        durationTime: 0,
        _paymentToken: response.tokenRoot,
        _price: toNano(1),
        recipient: response.nftOwner
    }).call()).value0;

    //deploy mintAndSell
    logger.log("Deploy mintAndSell");
    const mintAndSell = (await locklift.factory.deployContract({
        contract: "MintAndSell",
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _owner: account.address,
            _collection: collection.address,
            _targetManager: factoryDirectSell.address,
            _targetGas: targetGas,
            _targetPayload: targetPayload
        },
        initParams: {
            nonce_: locklift.utils.getRandomNonce()
        },
        value: toNano(1.6)
    })).contract;
    logger.success(`MintAndSell: ${mintAndSell.address}`);

    migration.store(mintAndSell, "MintAndSell");

    // Transfer collection ownership to MintAndSell
    logger.log("Transfer collection ownership to MintAndSell");
    await locklift.tracing.trace(collection.methods.transferOwnership({
        newOwner: mintAndSell.address
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