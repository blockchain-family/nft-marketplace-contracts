import {Contract, toNano, zeroAddress} from "locklift";
import {NftAbi, CollectionSimilarAbi, MintAndSellAbi, FactorySource, TokenRootUpgradeableAbi} from "../build/factorySource";
import { Address} from "everscale-inpage-provider";
import BigNumber from "bignumber.js";
BigNumber.config({EXPONENTIAL_AT: 257});
import { Account } from "everscale-standalone-client/nodejs";
import { expect } from "chai";

const logger = require("mocha-logger");
import {deployAccount, deployFactoryDirectSell, deployTokenRoot, deployWeverRoot} from "./utils";
import {Token} from "./wrappers/token";
import {DirectSell, FactoryDirectSell} from "./wrappers/DirectSell";
import {TokenWallet} from "./wrappers/token_wallet";

const NFT_COUNT = 25;

let account1: Account;
let account2: Account;
let collection: Contract<CollectionSimilarAbi>;
let mintAndSell: Contract<MintAndSellAbi>;
let factoryDirectSell: FactoryDirectSell;
let tokenRoot: Token;
let tokenWallet1: TokenWallet;
let tokenWallet2: TokenWallet;
let startBalanceTW1: number = 5000000000;
let startBalanceTW2: number = 5000000000;
let startBalance1;
let startBalance2;

let recipient: Address;
let targetPayload: string;
let targetGas: number;
let weverVault: Address;
let weverRoot: Token;
let fee = { numerator: '0', denominator: '100' };

async function balance(account: Account){
    return new BigNumber(await locklift.provider.getBalance(account.address));
}

describe("Test MintAndSell contract", async function () {
    it('Deploy accounts', async function () {
        account1 = await deployAccount(0, 10000);
        logger.log(`Account 1: ${account1.address}`);
        account2 = await deployAccount(1, 10);
        logger.log(`Account 2: ${account2.address}`);
    });
    it('Deploy WeverRoot and WeverVault', async function () {
        let result = await deployWeverRoot('weverTest', 'WTest', account1);
        weverRoot = result['root'];
        weverVault = result['vault'];
    });
    it('Deploy TIP-3 token', async function () {
        tokenRoot = weverRoot;
    });
    it('Mint TIP-3 token to account', async function () {
        let gasValue = 1000000000;
        let addressTW1 = await tokenRoot.walletAddr(account1.address);
        tokenWallet1 = await TokenWallet.from_addr(addressTW1, account1);
        let amount1 = new BigNumber(startBalanceTW1).plus(gasValue).toString();
        await locklift.provider.sendMessage({
            sender: account1.address,
            recipient: weverVault,
            amount: amount1,
            bounce: false
        });

        let addressTW2 = await tokenRoot.walletAddr(account2.address);
        tokenWallet2 = await TokenWallet.from_addr(addressTW2, account2);
        let amount2 = new BigNumber(startBalanceTW2).plus(gasValue).toString();
        await locklift.provider.sendMessage({
            sender: account2.address,
            recipient: weverVault,
            amount: amount2,
            bounce: false
        });
        startBalanceTW1 =  await tokenWallet1.balance() as any;
        startBalanceTW2 =  await tokenWallet2.balance() as any;

    });
    it('Deploy FactoryDirectSell', async function () {
        factoryDirectSell = await deployFactoryDirectSell(account1, fee, weverVault, weverRoot.address);
        const dSMFChanged = await factoryDirectSell.getEvent('MarketFeeDefaultChanged') as any;
        expect(dSMFChanged.fee).to.be.not.null;
    });
    it( 'Calculate targetGas',async function () {
        const gas = (await factoryDirectSell.contract.methods.getGasValue().call()).value0;
        const gasPrice = new BigNumber(1).shiftedBy(9).div(gas.gasK);
        targetGas = new BigNumber(gas.sell.dynamicGas).times(gasPrice).plus(gas.sell.fixedValue).toNumber();
    });
    it( 'Build targetPayload',async function () {
        recipient = account1.address;
        targetPayload = (await factoryDirectSell.buildPayload(
                0,
                Math.round(Date.now() / 1000),
                0,
                tokenRoot,
                toNano(1),
                recipient
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
                patterns: [{
                    name: 'Name',
                    description: 'Description',
                    previewUrl: '1',
                    previewMimeType: 'image/png',
                    fileUrl: '2',
                    fileMimeType: 'image/png',
                    externalUrl: '3',
                    attributes: []
                }],
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

        // await traceTree?.beautyPrint();
        // console.log("balanceChangeInfo");
        //
        // for (let addr in traceTree?.balanceChangeInfo) {
        //     console.log(addr + ": " + traceTree?.balanceChangeInfo[addr].balanceDiff.shiftedBy(-9).toString());
        // }
    });
    it(`Drain MintAndSell`, async function () {
        const { traceTree } = await locklift.tracing.trace(mintAndSell.methods.drainGas({}).send({
            from: account1.address,
            amount: toNano(0.01)
        }));
        // traceTree?.beautyPrint();
        // console.log("balanceChangeInfo");
        //
        // for(let addr in traceTree?.balanceChangeInfo) {
        //     console.log(addr + ": " + traceTree?.balanceChangeInfo[addr].balanceDiff.shiftedBy(-9).toString());
        // }
    });
    it(`Batch sell ${NFT_COUNT} nft`, async function () {
        const { traceTree } = await locklift.tracing.trace(mintAndSell.methods.sellItems({_fromId: 1, _toId: NFT_COUNT}).send({
            from: account1.address,
            amount: new BigNumber(targetGas).shiftedBy(-9).plus(0.4).times(NFT_COUNT)
                .plus(1)
                .shiftedBy(9).toString()
        }));

        // await traceTree?.beautyPrint();
        //
        // console.log("balanceChangeInfo");
        //
        // for(let addr in traceTree?.balanceChangeInfo) {
        //     console.log(addr + ": " + traceTree?.balanceChangeInfo[addr].balanceDiff.shiftedBy(-9).toString());
        // }
    });
    it(`Cancel sell`, async function () {
        let nft1 = (await mintAndSell.methods.expectedNftAddress({_id: 1}).call()).nft;
        const NftForSell = await locklift.factory.getDeployedContract("Nft", new Address(nft1.toString()))

        let directSellAddress = (await NftForSell.methods.getInfo({answerId: 0}).call()).manager;
        const directSell = await DirectSell.from_addr(directSellAddress, account1);

        let directSellInfo = await directSell.getInfo();
        expect(directSellInfo.creator.toString()).to.be.eq(recipient.toString());

        await directSell.closeSell(0, toNano(3));

        let nftInfo = await NftForSell.methods.getInfo({answerId: 0}).call();
        // console.log('owner', nftInfo.owner.toString());
        // console.log('manager', nftInfo.manager.toString());
        expect(nftInfo.owner.toString()).to.be.eq(recipient.toString());
        expect(nftInfo.manager.toString()).to.be.eq(recipient.toString());

        const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
        expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2).toString());
        const spentTokenWallet1Balance = await tokenWallet1.balance() as any;
        expect(spentTokenWallet1Balance.toString()).to.be.eq((startBalanceTW1).toString());
    });
    it(`Buy`, async function () {
        // let nft0 = (await collection.methods.nftAddress({answerId: 0, id: 0}).call());
        let nft2 = (await mintAndSell.methods.expectedNftAddress({_id: 2}).call()).nft;
        const NftForBuy = await locklift.factory.getDeployedContract("Nft", new Address(nft2.toString()));

        let directSellAddress = (await NftForBuy.methods.getInfo({answerId: 0}).call()).manager;
        logger.log('directSellAddress', directSellAddress.toString());
        const directSell = await DirectSell.from_addr(directSellAddress, account1);

        startBalance1 = await balance(account1);

        const { traceTree } = await tokenWallet2.transfer(1000000000, directSell.address, 0, true, '', toNano(3));
        // await traceTree?.beautyPrint();
        // console.log('Gas', new BigNumber(await traceTree?.totalGasUsed()).shiftedBy(-9).toNumber());
        // console.log("balanceChangeInfo");
        // for(let addr in traceTree?.balanceChangeInfo) {
        //     console.log(addr + ": " + traceTree?.balanceChangeInfo[addr].balanceDiff.shiftedBy(-9).toString());
        // }


        const dSFilled = await directSell.getEvent('DirectSellStateChanged') as any;
        expect(dSFilled.to.toString()).to.be.eq('3');

        let currentFee = new BigNumber(1000000000).div(fee.denominator).times(fee.numerator);

        const expectedAccountBalance = startBalance1.plus(1000000000).minus(currentFee).shiftedBy(-9).toNumber();
        const everAccount1Balance = (await balance(account1)).shiftedBy(-9).toNumber();
        expect(everAccount1Balance).to.be.closeTo(expectedAccountBalance, 0.2);

        const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
        expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - 1000000000).toString());

        let nftInfo = await NftForBuy.methods.getInfo({answerId: 0}).call();
        expect(nftInfo.owner.toString()).to.be.eq(account2.address.toString());
        expect(nftInfo.manager.toString()).to.be.eq(account2.address.toString());

        startBalanceTW2 -= 1000000000;
    });
    it(`Finish sell`, async function () {
        let nft3 = (await mintAndSell.methods.expectedNftAddress({_id: 3}).call()).nft;
        const NftForFinish = await locklift.factory.getDeployedContract("Nft", new Address(nft3.toString()))

        let directSellAddress = (await NftForFinish.methods.getInfo({answerId: 0}).call()).manager;
        const directSell = await DirectSell.from_addr(directSellAddress, account1);

        let directSellInfo = await directSell.getInfo();
        expect(directSellInfo.creator.toString()).to.be.eq(recipient.toString());

        startBalance1 = await balance(account1);

        await directSell.finishSell(account2, 0, toNano(3));

        const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
        expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2).toString());
        const spentTokenWallet1Balance = await tokenWallet1.balance() as any;
        expect(spentTokenWallet1Balance.toString()).to.be.eq((startBalanceTW1).toString());

        let nftInfo = await NftForFinish.methods.getInfo({answerId: 0}).call();
        expect(nftInfo.owner.toString()).to.be.eq(recipient.toString());
        expect(nftInfo.manager.toString()).to.be.eq(recipient.toString());
    });
    it(`Get ownership collection back`, async function () {

        let ownerCollection = (await collection.methods.owner().call()).value0;
        expect(ownerCollection.toString()).to.be.eq(mintAndSell.address.toString());

        await mintAndSell.methods.getCollectionOwnershipBack({
            newOwner: account1.address
        }).send({
            from: account1.address,
            amount: toNano(1.5)
        });

        let newOwnerCollection = (await collection.methods.owner().call()).value0;
        expect(newOwnerCollection.toString()).to.be.eq(account1.address.toString());
    });
});
