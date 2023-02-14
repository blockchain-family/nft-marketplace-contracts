import {Contract, toNano, zeroAddress} from "locklift";
import {NftAbi, CollectionSimilarAbi, MintAndSellAbi, FactorySource, TokenRootUpgradeableAbi} from "../build/factorySource";
import BigNumber from "bignumber.js";
BigNumber.config({EXPONENTIAL_AT: 257});
import { Account } from "everscale-standalone-client/nodejs";
import { expect } from "chai";

const logger = require("mocha-logger");
import {deployAccount, deployFactoryDirectSell, deployTokenRoot} from "./utils";
import {Token} from "./wrappers/token";
import {FactoryDirectSell} from "./wrappers/DirectSell";

const NFT_COUNT = 25;

let account1: Account;
let account2: Account;
let collection: Contract<CollectionSimilarAbi>;
let mintAndSell: Contract<MintAndSellAbi>;
let factoryDirectSell: FactoryDirectSell;
let tokenRoot: Token;

let targetPayload: string;
let targetGas: number;

describe("Test MintAndSell contract", async function () {
    it('Deploy accounts', async function () {
        account1 = await deployAccount(0, 10000);
        logger.log(`Account 1: ${account1.address}`);
        account2 = await deployAccount(1, 10);
        logger.log(`Account 2: ${account2.address}`);
    });
    it('Deploy TIP-3 token', async function () {
        tokenRoot = await deployTokenRoot('Test', 'Test', account1);
        logger.log(`TokenRoot: ${tokenRoot.address}`);
    });
    it('Deploy FactoryDirectSell', async function () {
        factoryDirectSell = await deployFactoryDirectSell(account1, { numerator: '0', denominator: '100' }, zeroAddress, zeroAddress);
        const dSMFChanged = await factoryDirectSell.getEvent('MarketFeeDefaultChanged') as any;
        expect(dSMFChanged.fee).to.be.not.null;
    });
    it( 'Calculate targetGas',async function () {
        const gas = (await factoryDirectSell.contract.methods.getGasValue().call()).value0;
        const gasPrice = new BigNumber(1).shiftedBy(9).div(gas.gasK);
        targetGas = new BigNumber(gas.sell.dynamicGas).times(gasPrice).plus(gas.sell.fixedValue).toNumber();
    });
    it( 'Build targetPayload',async function () {
        targetPayload = (await factoryDirectSell.buildPayload(
                0,
                Math.round(Date.now() / 1000),
                0,
                tokenRoot,
                toNano(1),
                account1.address
            )
        );
    });
    it('Deploy collection', async function () {
        const Nft = (await locklift.factory.getContractArtifacts("Nft"));
        const Index = (await locklift.factory.getContractArtifacts("Index"));
        const IndexBasis = (await locklift.factory.getContractArtifacts("IndexBasis"));
        const signer = await locklift.keystore.getSigner('0');

        collection = (await locklift.factory.deployContract({
            contract: "CollectionSimilar",
            publicKey: (signer?.publicKey) as string,
            constructorParams: {
                codeNft: Nft.code,
                codeIndex: Index.code,
                codeIndexBasis: IndexBasis.code,
                owner: account1.address,
                remainOnNft: toNano(0.3),
                json: JSON.stringify({
                    "type": "Basic NFT",
                    "name": "Sample Name",
                    "description": "Description about NFT collection!",
                    "preview": {
                        "source": "",
                        "mimetype": "image/png"
                    },
                    "files": [
                        {
                            "source": "",
                            "mimetype": "image/png"
                        }
                    ],
                    "external_url": ""
                }),
                pattern: {
                    name: 'Name',
                    description: 'Description',
                    previewUrl: '1',
                    previewMimeType: 'image/png',
                    fileUrl: '2',
                    fileMimeType: 'image/png',
                    externalUrl: '3',
                    attributes: []
                },
            },
            initParams: {
                nonce_: locklift.utils.getRandomNonce()
            },
            value: toNano(5)
        })).contract;

        logger.log(`Collection: ${collection.address}`);
    });

    it('Deploy MintAndSell', async function () {
        const signer = await locklift.keystore.getSigner('0');
        mintAndSell = (await locklift.factory.deployContract({
            contract: "MintAndSell",
            publicKey: (signer?.publicKey) as string,
            constructorParams: {
                _owner: account1.address,
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
        logger.log(`MintAndSell: ${mintAndSell.address}`);
    });

    it('Transfer collection ownership to MintAndSell', async function () {
        const { traceTree } = await locklift.tracing.trace(collection.methods.transferOwnership({
            newOwner: mintAndSell.address
        }).send({
            from: account1.address,
            amount: toNano(1)
        }));
    });

    it(`Batch mint ${NFT_COUNT} nft`, async function () {
        const { traceTree } = await locklift.tracing.trace(mintAndSell.methods.createItems({_fromId: 1, _toId: NFT_COUNT}).send({
            from: account1.address,
            amount: new BigNumber(NFT_COUNT).times(1.1).plus(1).shiftedBy(9).toString()
        }));

        await traceTree?.beautyPrint();
        console.log("balanceChangeInfo");

        for (let addr in traceTree?.balanceChangeInfo) {
            console.log(addr + ": " + traceTree?.balanceChangeInfo[addr].balanceDiff.shiftedBy(-9).toString());
        }
    });

    it(`Drain MintAndSell`, async function () {
        const { traceTree } = await locklift.tracing.trace(mintAndSell.methods.drainGas({}).send({
            from: account1.address,
            amount: toNano(0.01)
        }));
        traceTree?.beautyPrint();
        console.log("balanceChangeInfo");

        for(let addr in traceTree?.balanceChangeInfo) {
            console.log(addr + ": " + traceTree?.balanceChangeInfo[addr].balanceDiff.shiftedBy(-9).toString());
        }
    });

    it(`Batch sell ${NFT_COUNT} nft`, async function () {
        const { traceTree } = await locklift.tracing.trace(mintAndSell.methods.sellItems({_fromId: 1, _toId: NFT_COUNT}).send({
            from: account1.address,
            amount: new BigNumber(targetGas).shiftedBy(-9).plus(0.4).times(NFT_COUNT)
                .plus(1)
                .shiftedBy(9).toString()
        }));

        await traceTree?.beautyPrint();

        console.log("balanceChangeInfo");

        for(let addr in traceTree?.balanceChangeInfo) {
            console.log(addr + ": " + traceTree?.balanceChangeInfo[addr].balanceDiff.shiftedBy(-9).toString());
        }
    });

});
