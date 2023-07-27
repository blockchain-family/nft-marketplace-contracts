import {
    deployAccount,
    deployTokenRoot,
    deployCollectionAndMintNft,
    CallbackType,
    sleep,
    deployFactoryDirectBuy,
    deployWeverRoot
} from "./utils";
import { Account } from "everscale-standalone-client/nodejs";
import { FactoryDirectBuy, DirectBuy } from "./wrappers/DirectBuy";
import { NftC } from "./wrappers/nft";
import { Token } from "./wrappers/token";
import { TokenWallet } from "./wrappers/token_wallet";
import {BigNumber} from "bignumber.js";
import {Address, Contract, toNano} from "locklift";
import {FactorySource} from "../build/factorySource";

const logger = require('mocha-logger');
const { expect } = require('chai');

let account1: Account;
let account2: Account;
let account3: Account;

let nft: NftC;

let tokenRoot: Token;
let tokenWallet2: TokenWallet;
let tokenWallet3: TokenWallet;

let factoryDirectBuy: FactoryDirectBuy;
let directBuy: DirectBuy;
let startBalanceTW2: number = 90000000000;
let startBalanceTW3: number = 90000000000;

type MarketFee = {
    numerator: string;
    denominator: string;
}

type MarketBurnFee = {
    numerator: string;
    denominator: string;
    project: Address;
    burnRecipient: Address;
}

let fee: MarketFee;
let factoryDirectBuyTWAddress: Address;
let factoryDirectBuyTW: TokenWallet;
let startBalanceTWfactoryDirectBuy: BigNumber;

let weverVault: Address;
let weverRoot: Token;
type GasValue = {
    fixedValue: string,
    dynamicGas: string;
}
let gasValue: any;
let changeManagerValue: string;
let transferValue: string;
let cancelValue : string;

type CollectionDiscountInfo = {
    codeHash: string,
    codeDepth: string,
    numerator: string,
    denominator: string;
}
let discountInfo: CollectionDiscountInfo;
let discountCollection: Contract<FactorySource["Collection"]>;
let codeDepth = '15';
let nftId: number = 0;

async function Callback(payload: string) {
    let callback: CallbackType;
    callback = [
        directBuy.address,
        {
            value: calcValue(gasValue.accept, gasValue.gasK) .toString(),
            payload: '',
        },
    ];
    const callbacks: CallbackType[] = [];
    callbacks.push(callback);
    return callbacks;
};

function calcValue(gas: GasValue, gasK: string){
    const gasPrice = new BigNumber(1).shiftedBy(9).div(gasK);
    return new BigNumber(gas.dynamicGas).times(gasPrice).plus(gas.fixedValue).toNumber();
}

describe("Test DirectBuy contract", async function () {
    it('Deploy account', async function () {
        account1 = await deployAccount(0, 30);
        account2 = await deployAccount(1, 60);
        account3 = await deployAccount(2, 60);
    });
    it('Deploy NFT-Collection and Mint Nft', async function () {
        let accForNft: Account[] = [];
        accForNft.push(account2);

        const [collection, nftS] = await deployCollectionAndMintNft(account1, 1, "nft_to_address.json", accForNft);
        nft = nftS[0];
        locklift.tracing.setAllowedCodesForAddress(collection.address, { compute: [60]});
        locklift.tracing.setAllowedCodesForAddress(nft.address, { compute: [60]});
    });
    it('Deploy discount Collection and Mint Nft for Account3', async function () {
        let accForNft: Account[] = [];
        accForNft.push(account3);

        const [collection, nftS] = await deployCollectionAndMintNft(account1, 1, "nft_to_address.json", accForNft);
        // nft2 = nftS[nftId];
        discountCollection = collection;
    });
    it('Deploy WeverRoot and WeverVault', async function () {
        let result = await deployWeverRoot('weverTest', 'WTest', account1);
        weverRoot = result['root'];
        weverVault = result['vault'];
    });
    it('Deploy TIP-3 token', async function () {
        tokenRoot = await deployTokenRoot('Test', 'Test', account1);
    });
    it('Mint TIP-3 token to account', async function () {
        tokenWallet2 = await tokenRoot.mint(startBalanceTW2, account2);
        tokenWallet3 = await tokenRoot.mint(startBalanceTW3, account3);
    });
    it('Deploy FactoryDirectBuy with fee denominator zero', async function () {
        let fee = {
            numerator: '10',
            denominator: '0'
        } as MarketFee;
        const factoryDirectBuyExitCode = await deployFactoryDirectBuy(account1, fee, weverVault, weverRoot.address).catch(e => e.transaction.transaction.exitCode);
        expect(factoryDirectBuyExitCode.toString()).to.be.eq('110');
    });
    it('Deploy FactoryDirectBuy', async function () {
        let fee = {
            numerator: '10',
            denominator: '100'
        } as MarketFee;
        factoryDirectBuy = await deployFactoryDirectBuy(account1, fee, weverVault, weverRoot.address);
        const dBMFChanged = await factoryDirectBuy.getEvent('MarketFeeDefaultChanged') as any;
        expect(dBMFChanged.fee).to.be.not.null;
    });
    it('Get address token wallet for FactoryDirectBuy', async function () {
        factoryDirectBuyTWAddress = await tokenRoot.walletAddr(factoryDirectBuy.address);
        factoryDirectBuyTW = await TokenWallet.from_addr(factoryDirectBuyTWAddress, null);
        startBalanceTWfactoryDirectBuy = new BigNumber(await factoryDirectBuyTW.balanceSafe());
    });
    it( 'Get market fee',async function () {
        fee = (await factoryDirectBuy.contract.methods.marketFee().call()).value0;
    });
    it('Create CollectionDiscountInfo and add discount to Collection', async function () {
        let codeHash = await discountCollection.methods.nftCodeHash({answerId: 0}).call();
        // codeDepth = await discountCollection.methods.codeDepth({}).call().value0;
        // console.log(codeHash.codeHash);
        discountInfo = {
            codeHash: codeHash.codeHash,
            codeDepth: codeDepth,
            numerator: '3',
            denominator: '100'
        }
        await factoryDirectBuy.contract.methods.addCollectionsSpecialRules({
            _collection: discountCollection.address,
            _collectionFeeInfo: discountInfo
        }).send(
            {
                from: account1.address,
                amount: toNano(1)
            });
         const a = await factoryDirectBuy.contract.methods.collectionsSpecialRules({}).call()
         // console.log(a.collectionsSpecialRules);

    });
    it( 'Get fas value',async function () {
        gasValue = (await factoryDirectBuy.contract.methods.getGasValue().call()).value0;
        console.log(gasValue);
        changeManagerValue =  (calcValue(gasValue.accept, gasValue.gasK) + 200000000).toString();
        transferValue = (calcValue(gasValue.make, gasValue.gasK) + 300000000).toString();
        cancelValue = (calcValue(gasValue.cancel, gasValue.gasK) + 200000000).toString();
        console.log('transferValue',transferValue);
        console.log('changeManagerValue',changeManagerValue);
        console.log('cancelValue',cancelValue);
    });
    describe("DirectBuy completed", async function () {
        it('Deploy limited DirectBuy and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, account3, nft, Math.round(Date.now() / 1000), 5, discountCollection.address, nftId));
            const {traceTree} = await tokenWallet3.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);
            // await traceTree.beautyPrint();
            // console.log('Gas', new BigNumber(await traceTree?.totalGasUsed()).shiftedBy(-9).toNumber());
            // console.log("balanceChangeInfo");
            // for(let addr in traceTree?.balanceChangeInfo) {
            //     console.log(addr + ": " + traceTree?.balanceChangeInfo[addr].balanceDiff.shiftedBy(-9).toString());
            // }
            let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);

            directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account3);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            let discountFee = (await directBuy.contract.methods.marketFee().call()).value0;
            expect(discountInfo.numerator).to.be.eq(discountFee.numerator);
            expect(discountInfo.denominator).to.be.eq(discountFee.denominator);

            let callbacks = await Callback(payload);
            await nft.changeManager(account2, directBuy.address, account2.address, callbacks, changeManagerValue);
            const dBFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dBFilled.to.toString()).to.be.eq('3');

            const owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq((account3.address).toString());

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            let currentFee = new BigNumber(spentToken).div(discountInfo.denominator).times(discountInfo.numerator);
            const expectedAccountBalance = new BigNumber(startBalanceTW2).plus(spentToken).minus(currentFee);
            const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
            const expectedTWFactoryDBBalance = startBalanceTWfactoryDirectBuy.plus(currentFee);
            expect(factoryDBTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDBBalance.toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq(expectedAccountBalance.toString());

            spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            startBalanceTW2 = startBalanceTW2 +spentToken - currentFee.toNumber();
            startBalanceTW3 -= spentToken;
            startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.plus(currentFee);
        });
        it('Deploy future limited DirectBuy and success', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, account2, nft, Math.round(Date.now() / 1000) + 5, 8));
            await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);

            let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);

            directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account3);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            await sleep(5000);
            let callbacks = await Callback(payload);
            await nft.changeManager(account3, directBuy.address, account3.address, callbacks, changeManagerValue);

            const dBFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dBFilled.to.toString()).to.be.eq('3');

            const owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq((account2.address).toString());

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account2.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account2.address.toString());

            let currentFee = new BigNumber(spentToken).div(fee.denominator).times(fee.numerator);
            const expectedAccountBalance = new BigNumber(startBalanceTW3).plus(spentToken).minus(currentFee);
            const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
            const expectedTWFactoryDBBalance = startBalanceTWfactoryDirectBuy.plus(currentFee);
            expect(factoryDBTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDBBalance.toString());

            spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq(expectedAccountBalance.toString());

            startBalanceTW3 = startBalanceTW3 + spentToken - currentFee.toNumber();
            startBalanceTW2 -= spentToken;
            startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.plus(currentFee);
        });
        // it('Deploy unlimited DirectBuy and success', async function () {
        //     const spentToken: number = 5000000000;
        //     let payload: string;
        //     payload = (await factoryDirectBuy.buildPayload(0, account3, nft, Math.round(Date.now() / 1000), 0, discountCollection.address, nftId));
        //     await tokenWallet3.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);
        //
        //     let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
        //     expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());
        //
        //     const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
        //     logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);
        //
        //     directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account3);
        //     const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
        //     expect(dbFilled.to.toString()).to.be.eq('2');
        //
        //     sleep(5000);
        //     let callbacks = await Callback(payload);
        //     await nft.changeManager(account2, directBuy.address, account2.address, callbacks, changeManagerValue);
        //     const dBFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
        //     expect(dBFilled.to.toString()).to.be.eq('3');
        //
        //     const owner = (await nft.getInfo()).owner;
        //     expect(owner.toString()).to.be.eq((account3.address).toString());
        //
        //     const ownerChanged = await nft.getEvent('OwnerChanged') as any;
        //     expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());
        //
        //     const managerChanged = await nft.getEvent('ManagerChanged') as any;
        //     expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());
        //
        //     let currentFee = new BigNumber(spentToken).div(discountInfo.denominator).times(discountInfo.numerator);
        //     const expectedAccountBalance = new BigNumber(startBalanceTW2).plus(spentToken).minus(currentFee);
        //     const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
        //     const expectedTWFactoryDBBalance = startBalanceTWfactoryDirectBuy.plus(currentFee);
        //     expect(factoryDBTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDBBalance.toString());
        //
        //     const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
        //     expect(spentTokenWallet2Balance.toString()).to.be.eq(expectedAccountBalance.toString());
        //
        //     spentTokenWallet3Balance = await tokenWallet3.balance() as any;
        //     expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());
        //
        //     startBalanceTW2 = startBalanceTW2 + spentToken - currentFee.toNumber();
        //     startBalanceTW3 -= spentToken;
        //     startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.plus(currentFee);
        // });
        // it('Deploy future unlimited DirectBuy and success and not owner discount nft', async function () {
        //     const spentToken: number = 1000000000;
        //     let payload: string;
        //     payload = (await factoryDirectBuy.buildPayload(0, account2, nft, Math.round(Date.now() / 1000) + 5, 0, discountCollection.address, nftId));
        //     await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);
        //
        //     let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
        //     expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());
        //
        //     const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
        //     logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);
        //
        //     directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account3);
        //     const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
        //     expect(dbFilled.to.toString()).to.be.eq('2');
        //
        //     await sleep(5000);
        //     let callbacks = await Callback(payload);
        //     await nft.changeManager(account3, directBuy.address, account3.address, callbacks, changeManagerValue);
        //
        //     const dBFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
        //     expect(dBFilled.to.toString()).to.be.eq('3');
        //
        //     const owner = (await nft.getInfo()).owner;
        //     expect(owner.toString()).to.be.eq((account2.address).toString());
        //
        //     const ownerChanged = await nft.getEvent('OwnerChanged') as any;
        //     expect(ownerChanged.newOwner.toString()).to.be.eq(account2.address.toString());
        //
        //     const managerChanged = await nft.getEvent('ManagerChanged') as any;
        //     expect(managerChanged.newManager.toString()).to.be.eq(account2.address.toString());
        //
        //     let currentFee = new BigNumber(spentToken).div(fee.denominator).times(fee.numerator);
        //     const expectedAccountBalance = new BigNumber(startBalanceTW3).plus(spentToken).minus(currentFee);
        //     const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
        //     const expectedTWFactoryDBBalance = startBalanceTWfactoryDirectBuy.plus(currentFee);
        //     expect(factoryDBTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDBBalance.toString());
        //
        //     spentTokenWallet2Balance = await tokenWallet2.balance() as any;
        //     expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());
        //
        //     const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
        //     expect(spentTokenWallet3Balance.toString()).to.be.eq(expectedAccountBalance.toString());
        //
        //     startBalanceTW3 = startBalanceTW3 + spentToken - currentFee.toNumber();
        //     startBalanceTW2 -= spentToken;
        //     startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.plus(currentFee);
        // });
        // it('Deploy future DirectBuy and aborted then success', async function () {
        //     const spentToken: number = 1000000000;
        //     let payload: string;
        //     payload = (await factoryDirectBuy.buildPayload(0, account3, nft, Math.round(Date.now() / 1000) + 5, 8, discountCollection.address, nftId));
        //     await tokenWallet3.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);
        //
        //     let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
        //     expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());
        //
        //     const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
        //     logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);
        //
        //     directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account3);
        //     const dbActive = await directBuy.getEvent('DirectBuyStateChanged') as any;
        //     expect(dbActive.to.toString()).to.be.eq('2');
        //
        //     let callbacks = await Callback(payload);
        //     await nft.changeManager(account2, directBuy.address, account2.address, callbacks, changeManagerValue);
        //     expect(dbActive.to.toString()).to.be.eq('2');
        //
        //     await sleep(5000);
        //     await nft.changeManager(account2, directBuy.address, account2.address, callbacks, changeManagerValue);
        //
        //     const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
        //     expect(dbFilled.to.toString()).to.be.eq('3');
        //
        //     const owner = (await nft.getInfo()).owner;
        //     expect(owner.toString()).to.be.eq((account3.address).toString());
        //
        //     const managerChanged = await nft.getEvent('ManagerChanged') as any;
        //     expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());
        //
        //     const ownerChanged = await nft.getEvent('OwnerChanged') as any;
        //     expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());
        //
        //     let currentFee = new BigNumber(spentToken).div(discountInfo.denominator).times(discountInfo.numerator);
        //     const expectedAccountBalance = new BigNumber(startBalanceTW2).plus(spentToken).minus(currentFee);
        //     const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
        //     const expectedTWFactoryDBBalance = startBalanceTWfactoryDirectBuy.plus(currentFee);
        //     expect(factoryDBTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDBBalance.toString());
        //
        //     const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
        //     expect(spentTokenWallet2Balance.toString()).to.be.eq(expectedAccountBalance.toString());
        //
        //     spentTokenWallet3Balance = await tokenWallet3.balance() as any;
        //     expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());
        //
        //     startBalanceTW2 = startBalanceTW2 + spentToken - currentFee.toNumber();
        //     startBalanceTW3 -= spentToken;
        //     startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.plus(currentFee);
        // });
    });
    // describe("DirectBuy cancel", async function () {
    //     it('Deploy DirectBuy and cancel', async function () {
    //         const spentToken: number = 5000000000;
    //         let payload: string;
    //         payload = (await factoryDirectBuy.buildPayload(0, account2, nft, Math.round(Date.now() / 1000), 5));
    //
    //         await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);
    //
    //         const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
    //         expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());
    //
    //         const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
    //         logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);
    //
    //         directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account2);
    //         const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
    //         expect(dbFilled.to.toString()).to.be.eq('2');
    //
    //         await directBuy.closeBuy(0, cancelValue);
    //
    //         const dbClosed = await directBuy.getEvent('DirectBuyStateChanged') as any;
    //         expect(dbClosed.to.toString()).to.be.eq('4');
    //
    //         const owner = (await nft.getInfo()).owner;
    //         expect(owner.toString()).to.be.eq((account3.address).toString());
    //
    //         const spentTokenWallet2BalanceEnd = await tokenWallet2.balance() as any;
    //         expect(spentTokenWallet2BalanceEnd.toString()).to.be.eq((startBalanceTW2).toString());
    //     });
    //     it('Deploy DirectBuy and timeout', async function () {
    //         const spentToken: number = 5000000000;
    //         let payload: string;
    //         payload = (await factoryDirectBuy.buildPayload(0, account2, nft, Math.round(Date.now() / 1000), 10));
    //
    //         await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);
    //
    //         const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
    //         expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());
    //
    //         const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
    //         logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);
    //
    //         directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account2);
    //         const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
    //         expect(dbFilled.to.toString()).to.be.eq('2');
    //
    //         await directBuy.closeBuy(0, cancelValue);
    //
    //         const dbClosed = await directBuy.getEvent('DirectBuyStateChanged') as any;
    //         expect(dbClosed.to.toString()).to.be.eq('4');
    //
    //         const owner = (await nft.getInfo()).owner;
    //         expect(owner.toString()).to.be.eq((account3.address).toString());
    //
    //         const spentTokenWallet2BalanceEnd = await tokenWallet2.balance() as any;
    //         expect(spentTokenWallet2BalanceEnd.toString()).to.be.eq((startBalanceTW2).toString());
    //     });
    //     it('Deploy DirectBuy and instantly cancel', async function () {
    //         const spentToken: number = 5000000000;
    //         let payload: string;
    //         payload = (await factoryDirectBuy.buildPayload(0,account2, nft, Math.round((Date.now() / 1000) + 11), 5));
    //
    //         await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);
    //
    //         const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
    //         expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());
    //
    //         const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
    //         logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);
    //
    //         directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account2);
    //         const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
    //         expect(dbFilled.to.toString()).to.be.eq('2');
    //
    //         await directBuy.closeBuy(0, cancelValue);
    //
    //         const owner = (await nft.getInfo()).owner;
    //         expect(owner.toString()).to.be.eq((account3.address).toString())
    //
    //         const dbClosed = await directBuy.getEvent('DirectBuyStateChanged') as any;
    //         expect(dbClosed.to.toString()).to.be.eq('4');
    //
    //         const spentTokenWallet2BalanceEnd = await tokenWallet2.balance() as any;
    //         expect(spentTokenWallet2BalanceEnd.toString()).to.be.eq((startBalanceTW2).toString());
    //     });
    //     it('Deploy DirectBuy and expire after sending NFT', async function () {
    //         const spentToken: number = 5000000000;
    //         let payload: string;
    //         payload = (await factoryDirectBuy.buildPayload(0, account2, nft, Math.round(Date.now() / 1000), 1));
    //         await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);
    //
    //         const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
    //         expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());
    //
    //         const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
    //         logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);
    //
    //         directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account2);
    //         const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
    //         expect(dbFilled.to.toString()).to.be.eq('2');
    //
    //         await sleep(1000);
    //         let callbacks = await Callback(payload);
    //         await nft.changeManager(account3, directBuy.address, account3.address, callbacks, changeManagerValue);
    //
    //         const dbClosed = await directBuy.getEvent('DirectBuyStateChanged') as any;
    //         expect(dbClosed.to.toString()).to.be.eq('5');
    //
    //         const owner = (await nft.getInfo()).owner;
    //         expect(owner.toString()).to.be.eq((account3.address).toString());
    //
    //         const spentTokenWallet2BalanceEnd = await tokenWallet2.balance() as any;
    //         expect(spentTokenWallet2BalanceEnd.toString()).to.be.eq((startBalanceTW2).toString());
    //
    //         const spentTokenWallet3 = await tokenWallet3.balance() as any;
    //         expect(spentTokenWallet3.toString()).to.be.eq((startBalanceTW3).toString());
    //     });
    //     it('Deploy DirectBuy and expire by timeout', async function () {
    //         const spentToken: number = 5000000000;
    //         let payload: string;
    //         payload = (await factoryDirectBuy.buildPayload(0, account2, nft, Math.round(Date.now() / 1000), 1));
    //         await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);
    //
    //         const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
    //         expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());
    //
    //         const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
    //         logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);
    //
    //         directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account2);
    //         const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
    //         expect(dbFilled.to.toString()).to.be.eq('2');
    //
    //         await sleep(1000);
    //         await directBuy.finishBuy(account3, 0, cancelValue);
    //
    //         const owner = (await nft.getInfo()).owner;
    //         expect(owner.toString()).to.be.eq((account3.address).toString());
    //
    //         const dbClosed = await directBuy.getEvent('DirectBuyStateChanged') as any;
    //         expect(dbClosed.to.toString()).to.be.eq('5');
    //
    //         const spentTokenWallet2BalanceEnd = await tokenWallet2.balance() as any;
    //         expect(spentTokenWallet2BalanceEnd.toString()).to.be.eq((startBalanceTW2).toString());
    //
    //         const spentTokenWallet3 = await tokenWallet3.balance() as any;
    //         expect(spentTokenWallet3.toString()).to.be.eq((startBalanceTW3).toString());
    //     });
    // });
    // describe("Change market fee for direct buy", async function () {
    //     it('Change market fee and success buy', async function () {
    //         const spentToken: number = 5000000000;
    //         let payload: string;
    //         payload = (await factoryDirectBuy.buildPayload(0,account2, nft, Math.round(Date.now() / 1000), 0));
    //         await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);
    //
    //         let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
    //         expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());
    //
    //         const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
    //         logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);
    //
    //         directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account3);
    //         const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
    //         expect(dbFilled.to.toString()).to.be.eq('2');
    //
    //         let oldFee = (await factoryDirectBuy.contract.methods.marketFee().call()).value0;
    //         expect(oldFee).to.eql(fee);
    //
    //         let setFee = {
    //             numerator: '20',
    //             denominator: '100'
    //         } as MarketFee;
    //
    //         await factoryDirectBuy.contract.methods.setMarketFeeForChildContract({
    //             _offer: directBuy.address,
    //             _fee: setFee
    //         }).send({
    //                 from: account1.address,
    //                 amount: toNano(1)
    //         });
    //
    //         let newFee = (await directBuy.contract.methods.marketFee().call()).value0;
    //         expect(setFee.numerator).to.be.eq(newFee.numerator);
    //         expect(setFee.denominator).to.be.eq(newFee.denominator);
    //
    //         const dBMFChanged = await factoryDirectBuy.getEvent('MarketFeeChanged') as any;
    //         expect(dBMFChanged.fee).to.be.not.null;
    //
    //         sleep(5000);
    //         let callbacks = await Callback(payload);
    //         await nft.changeManager(account3, directBuy.address, account3.address, callbacks, changeManagerValue);
    //         const dBFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
    //         expect(dBFilled.to.toString()).to.be.eq('3');
    //
    //         const owner = (await nft.getInfo()).owner;
    //         expect(owner.toString()).to.be.eq((account2.address).toString());
    //
    //         const ownerChanged = await nft.getEvent('OwnerChanged') as any;
    //         expect(ownerChanged.newOwner.toString()).to.be.eq(account2.address.toString());
    //
    //         const managerChanged = await nft.getEvent('ManagerChanged') as any;
    //         expect(managerChanged.newManager.toString()).to.be.eq(account2.address.toString());
    //
    //         let currentFee = new BigNumber(spentToken).div(newFee.denominator).times(newFee.numerator);
    //         const expectedAccountBalance = new BigNumber(startBalanceTW3).plus(spentToken).minus(currentFee);
    //         const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
    //         const expectedTWFactoryDBBalance = startBalanceTWfactoryDirectBuy.plus(currentFee);
    //         expect(factoryDBTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDBBalance.toString());
    //
    //         const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
    //         expect(spentTokenWallet3Balance.toString()).to.be.eq(expectedAccountBalance.toString());
    //
    //         spentTokenWallet2Balance = await tokenWallet2.balance() as any;
    //         expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());
    //
    //         startBalanceTW3 = startBalanceTW3 + spentToken - currentFee.toNumber();
    //         startBalanceTW2 -= spentToken;
    //         startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.plus(currentFee);
    //     });
    // });
    // describe("Change market fee for factory", async function () {
    //     it('Change market fee', async function () {
    //         let oldFee = (await factoryDirectBuy.contract.methods.marketFee().call()).value0;
    //         expect(oldFee).to.eql(fee);
    //
    //         let setFee = {
    //             numerator: '20',
    //             denominator: '100'
    //         } as MarketFee;
    //
    //         await factoryDirectBuy.contract.methods.setMarketFee({_fee: setFee}).send({
    //                 from: account1.address,
    //                 amount: toNano(1)
    //         });
    //
    //         let newFee = (await factoryDirectBuy.contract.methods.marketFee().call()).value0;
    //         expect(setFee.numerator).to.eql(newFee.numerator);
    //         expect(setFee.denominator).to.eql(newFee.denominator);
    //         fee = newFee;
    //     });
    //     it('Change market fee with zero denominator', async function () {
    //         let oldFee = (await factoryDirectBuy.contract.methods.marketFee().call()).value0;
    //         expect(oldFee).to.eql(fee);
    //
    //         let setFee = {
    //             numerator: '20',
    //             denominator: '0'
    //         } as MarketFee;
    //
    //         await factoryDirectBuy.contract.methods.setMarketFee({_fee: setFee}).send({
    //                 from: account1.address,
    //                 amount: toNano(1)
    //         });
    //         let newFee = (await factoryDirectBuy.contract.methods.marketFee().call()).value0;
    //         expect(newFee).to.eql(oldFee);
    //     });
    //     it('Change market fee not owner', async function () {
    //         let oldFee = (await factoryDirectBuy.contract.methods.marketFee().call()).value0;
    //         expect(oldFee).to.eql(fee);
    //
    //         let setFee = {
    //             numerator: '30',
    //             denominator: '100'
    //         } as MarketFee;
    //
    //         await factoryDirectBuy.contract.methods.setMarketFee({_fee: setFee}).send({
    //                 from: account2.address,
    //                 amount: toNano(1)
    //         });
    //         let newFee = (await factoryDirectBuy.contract.methods.marketFee().call()).value0;
    //         expect(newFee).to.eql(oldFee);
    //     });
    // });
    // describe("Withdraw", async function () {
    //     it('Trying withdraw not owner', async function () {
    //         const withdrawAmount = 1000000000;
    //
    //         await factoryDirectBuy.withdraw(
    //             factoryDirectBuyTW.address,
    //             withdrawAmount,
    //             account2.address,
    //             account2.address,
    //             account2.address
    //         );
    //
    //         const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
    //         expect(factoryDBTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectBuy.toString());
    //         let spentTokenWallet2Balance = await tokenWallet2.balance();
    //         expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());
    //
    //     });
    //     it('Trying withdraw part of token', async function () {
    //         const withdrawAmount = 1000000000;
    //         const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
    //         expect(factoryDBTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectBuy.toString());
    //         let spentTokenWallet2Balance = await tokenWallet2.balance();
    //         expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());
    //
    //         await factoryDirectBuy.withdraw(
    //             factoryDirectBuyTW.address,
    //             withdrawAmount,
    //             account2.address,
    //             account1.address,
    //             account1.address
    //         );
    //
    //         const factoryDBTokenWalletBalance1 = await factoryDirectBuyTW.balance();
    //         expect(factoryDBTokenWalletBalance1.toString()).to.be.eq((startBalanceTWfactoryDirectBuy.minus(new BigNumber(withdrawAmount))).toString());
    //         let spentTokenWallet2Balance1 = await tokenWallet2.balance();
    //         expect(spentTokenWallet2Balance1.toString()).to.be.eq((startBalanceTW2 + withdrawAmount).toString());
    //
    //         startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.minus(new BigNumber(withdrawAmount));
    //         startBalanceTW2 = startBalanceTW2 + withdrawAmount;
    //     });
    //     it('Trying withdraw more then have', async function () {
    //         const withdrawAmount = 3300000000;
    //         const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
    //         expect(factoryDBTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectBuy.toString());
    //         let spentTokenWallet2Balance = await tokenWallet2.balance();
    //         expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());
    //
    //         await factoryDirectBuy.withdraw(
    //             factoryDirectBuyTW.address,
    //             withdrawAmount,
    //             account2.address,
    //             account1.address,
    //             account1.address
    //         );
    //
    //         const factoryDBTokenWalletBalance2 = await factoryDirectBuyTW.balance();
    //         expect(factoryDBTokenWalletBalance2.toString()).to.be.eq((startBalanceTWfactoryDirectBuy).toString());
    //         let spentTokenWallet2Balance1 = await tokenWallet2.balance();
    //         expect(spentTokenWallet2Balance1.toString()).to.be.eq((startBalanceTW2).toString());
    //     });
    //     it('Trying withdraw all rest of token', async function () {
    //         const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
    //         expect(factoryDBTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectBuy.toString());
    //         let spentTokenWallet2Balance = await tokenWallet2.balance();
    //         expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());
    //
    //         const withdrawAmount = factoryDBTokenWalletBalance;
    //
    //         await factoryDirectBuy.withdraw(
    //             factoryDirectBuyTW.address,
    //             BigNumber(withdrawAmount).toNumber(),
    //             account2.address,
    //             account1.address,
    //             account1.address
    //         );
    //
    //         const factoryDBTokenWalletBalance2 = await factoryDirectBuyTW.balance();
    //         expect(factoryDBTokenWalletBalance2.toString()).to.be.eq((0).toString());
    //         let spentTokenWallet2Balance1 = await tokenWallet2.balance();
    //         expect(spentTokenWallet2Balance1.toString()).to.be.eq((new BigNumber(startBalanceTW2).plus(withdrawAmount)).toString());
    //
    //         startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.minus(new BigNumber(withdrawAmount));
    //         startBalanceTW2 = (new BigNumber(startBalanceTW2).plus(withdrawAmount)).toNumber();
    //     });
    // });
    describe("Integration with Venom Burn", async function () {
        it('Deploy limited DirectBuy and success', async function () {
            let burnFee = {
                numerator: '10',
                denominator: '100',
                project: new Address("0:5b2d0dbcbe5caad0d4dc0bad049ea8d1565ae935ed4adc38b32758b7cdf33e81"),
                burnRecipient: new Address("0:5b2d0dbcbe5caad0d4dc0bad049ea8d1565ae935ed4adc38b32758b7cdf33e81")
            } as MarketBurnFee
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, account3, nft, Math.round(Date.now() / 1000), 5, discountCollection.address, nftId));
            const {traceTree} = await tokenWallet3.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);
            // await traceTree.beautyPrint();
            // console.log('Gas', new BigNumber(await traceTree?.totalGasUsed()).shiftedBy(-9).toNumber());
            // console.log("balanceChangeInfo");
            // for(let addr in traceTree?.balanceChangeInfo) {
            //     console.log(addr + ": " + traceTree?.balanceChangeInfo[addr].balanceDiff.shiftedBy(-9).toString());
            // }
            let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);

            directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account3);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            await locklift.tracing.trace(factoryDirectBuy.contract.methods.setMarketBurnFeeForChildContract({
                _offer: directBuy.address,
                _fee: burnFee
            }).send({
                from: account1.address,
                amount: toNano(1)
            }))

            let discountFee = (await directBuy.contract.methods.marketBurnFee().call()).value0;
            console.log(discountFee);
            expect(burnFee.numerator).to.be.eq(discountFee?.numerator);
            expect(burnFee.denominator).to.be.eq(discountFee?.denominator);

        });
        it('Change market burn fee with zero denominator', async function () {
            let setFee = {
                numerator: '10',
                denominator: '0',
                project: new Address("0:5b2d0dbcbe5caad0d4dc0bad049ea8d1565ae935ed4adc38b32758b7cdf33e81"),
                burnRecipient: new Address("0:5b2d0dbcbe5caad0d4dc0bad049ea8d1565ae935ed4adc38b32758b7cdf33e81")
            } as MarketBurnFee
            let oldFee = (await directBuy.contract.methods.marketBurnFee().call()).value0;

             await factoryDirectBuy.contract.methods.setMarketBurnFeeForChildContract({
                _offer: directBuy.address,
                _fee: setFee
            }).send({
                from: account1.address,
                amount: toNano(1)
            })

            let newFee = (await directBuy.contract.methods.marketBurnFee().call()).value0;
            expect(newFee?.denominator).to.eql(oldFee?.denominator);
            expect(newFee?.numerator).to.eql(oldFee?.numerator);
            expect(newFee?.project.toString()).to.eql(oldFee?.project.toString());
            expect(newFee?.burnRecipient.toString()).to.eql(oldFee?.burnRecipient.toString());
        });
        it('Change market burn fee not root', async function () {
            let setFee = {
                numerator: '20',
                denominator: '100',
                project: new Address("0:5b2d0dbcbe5caad0d4dc0bad049ea8d1565ae935ed4adc38b32758b7cdf33e81"),
                burnRecipient: new Address("0:5b2d0dbcbe5caad0d4dc0bad049ea8d1565ae935ed4adc38b32758b7cdf33e81")
            } as MarketBurnFee
            let oldFee = (await directBuy.contract.methods.marketBurnFee().call()).value0;

             await factoryDirectBuy.contract.methods.setMarketBurnFeeForChildContract({
                _offer: directBuy.address,
                _fee: setFee
            }).send({
                from: account2.address,
                amount: toNano(1)
            })

            let newFee = (await directBuy.contract.methods.marketBurnFee().call()).value0;
            expect(newFee?.denominator).to.eql(oldFee?.denominator);
            expect(newFee?.numerator).to.eql(oldFee?.numerator);
            expect(newFee?.project.toString()).to.eql(oldFee?.project.toString());
            expect(newFee?.burnRecipient.toString()).to.eql(oldFee?.burnRecipient.toString());

        });
    });
});
