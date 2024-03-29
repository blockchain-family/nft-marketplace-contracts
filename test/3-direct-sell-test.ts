import {
    CallbackType,
    deployAccount,
    deployCollectionAndMintNft,
    deployCollectionAndMintNftWithRoyalty,
    deployFactoryDirectSell,
    deployTokenRoot,
    deployWnativeRoot, now,
    tryIncreaseTime
} from "./utils";
import {Account} from "everscale-standalone-client/nodejs";
import {DirectSell, FactoryDirectSell} from "./wrappers/directSell";
import {NftC} from "./wrappers/nft";
import {Token} from "./wrappers/token";
import {TokenWallet} from "./wrappers/token_wallet";
import {Address, Contract, toNano} from "locklift";
import {BigNumber} from "bignumber.js";
import {FactorySource} from "../build/factorySource";

const logger = require('mocha-logger');
const {expect} = require('chai');

let account1: Account;
let account2: Account;
let account3: Account;
let account4: Account;


let nft: NftC;

let tokenRoot: Token;
let tokenWallet1: TokenWallet;
let tokenWallet2: TokenWallet;
let tokenWallet3: TokenWallet;
let tokenWallet4: TokenWallet;


let factoryDirectSell: FactoryDirectSell;
let directSell: DirectSell;

let startBalanceTW1: number = 90000000000;
let startBalanceTW2: number = 90000000000;
let startBalanceTW3: number = 90000000000;
let startBalanceTW4: number = 90000000000;


type MarketFee = {
    numerator: string;
    denominator: string;
}

type Royalty = {
    numerator: string;
    denominator: string;
    receiver: Address;
}

type MarketBurnFee = {
    numerator: string;
    denominator: string;
    project: Address;
    burnRecipient: Address;
}


let fee: MarketFee;
let burnFee: MarketBurnFee;
let setRoyalty: Royalty;
let factoryDirectSellTWAddress: Address;
let factoryDirectSellTW: TokenWallet;
let startBalanceTWfactoryDirectSell: BigNumber;

let wnativeRoot: Token;
type GasValue = {
    fixedValue: string,
    dynamicGas: string;
}
let gasValue: any;
let changeManagerValue: string;
let transferValue: string;
let cancelValue: string;

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
        factoryDirectSell.address,
        {
            value: calcValue(gasValue.sell, gasValue.gasK).toString(),
            payload: payload,
        },
    ];
    const callbacks: CallbackType[] = [];
    callbacks.push(callback);
    return callbacks;
}

function calcValue(gas: GasValue, gasK: string) {
    const gasPrice = new BigNumber(1).shiftedBy(9).div(gasK);
    return new BigNumber(gas.dynamicGas).times(gasPrice).plus(gas.fixedValue).toNumber();
}

describe("Test DirectSell contract", async function () {
    it('Deploy account', async function () {
        account1 = await deployAccount(0, 50);
        account2 = await deployAccount(1, 30);
        account3 = await deployAccount(2, 30);
        account4 = await deployAccount(3, 10);

    });
    it('Deploy NFT-Collection and Mint Nft', async function () {
        let accForNft: Account[] = [];
        accForNft.push(account1);
        const [collection, nftS] = await deployCollectionAndMintNft(account1, 1, "nft_to_address.json", accForNft);
        nft = nftS[0];
        locklift.tracing.setAllowedCodesForAddress(collection.address, {compute: [60]});
        locklift.tracing.setAllowedCodesForAddress(nft.address, {compute: [60]});
    });
    it('Deploy discount Collection and Mint Nft for Account2', async function () {
        let accForNft: Account[] = [];
        accForNft.push(account2);

        const [collection,] = await deployCollectionAndMintNft(account1, 1, "nft_to_address.json", accForNft);
        // nft2 = nftS[nftId];
        discountCollection = collection;
    });
    it('Deploy WnativeRoot and WnativeVault', async function () {
        let result = await deployWnativeRoot('wnativeTest', 'WTest', account1);
        wnativeRoot = result['root'];
    });
    it('Deploy TIP-3 token', async function () {
        tokenRoot = await deployTokenRoot('Test', 'Test', account1);
    });
    it('Mint TIP-3 token to account', async function () {
        tokenWallet1 = await tokenRoot.mint(startBalanceTW1, account1);
        tokenWallet2 = await tokenRoot.mint(startBalanceTW2, account2);
        tokenWallet3 = await tokenRoot.mint(startBalanceTW2, account3);
        tokenWallet4 = await tokenRoot.mint(startBalanceTW4, account4);

    });
    it('Deploy FactoryDirectSell with fee denominator zero', async function () {
        let fee = {
            numerator: '10',
            denominator: '0'
        } as MarketFee;

        const factoryDirectSellExitCode = await deployFactoryDirectSell(
            account1, fee, wnativeRoot.address
        ).catch(e => e.transaction.transaction.exitCode);
        expect(factoryDirectSellExitCode.toString()).to.be.eq('110');
    });
    it('Deploy FactoryDirectSell', async function () {
        let fee = {
            numerator: '10',
            denominator: '100'
        } as MarketFee;
        factoryDirectSell = await deployFactoryDirectSell(account1, fee, wnativeRoot.address);
        const dSMFChanged = await factoryDirectSell.getEvent('MarketFeeDefaultChanged') as any;
        expect(dSMFChanged._fee).to.be.not.null;
    });
    it('Get address token wallet for FactoryDirectSell', async function () {
        factoryDirectSellTWAddress = await tokenRoot.walletAddr(factoryDirectSell.address);
        factoryDirectSellTW = await TokenWallet.from_addr(factoryDirectSellTWAddress, null);
        startBalanceTWfactoryDirectSell = new BigNumber(await factoryDirectSellTW.balanceSafe());
    });
    it('Get market fee', async function () {
        fee = (await factoryDirectSell.contract.methods.marketFee().call()).value0;
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
        await factoryDirectSell.contract.methods.addCollectionsSpecialRules({
            _collection: discountCollection.address,
            _collectionFeeInfo: discountInfo
        }).send(
            {
                from: account1.address,
                amount: toNano(1)
            });
        const a = await factoryDirectSell.contract.methods.collectionsSpecialRules().call()
        // console.log(a.collectionsSpecialRules);

    });
    it('Get fas value', async function () {
        gasValue = (await factoryDirectSell.contract.methods.getGasValue().call()).value0;
        console.log(gasValue);
        changeManagerValue = (calcValue(gasValue.sell, gasValue.gasK) + 300000000).toString();
        transferValue = (calcValue(gasValue.buy, gasValue.gasK) + 250000000).toString();
        cancelValue = (calcValue(gasValue.cancel, gasValue.gasK) + 200000000).toString();
        console.log('transferValue', transferValue);
        console.log('changeManagerValue', changeManagerValue);
        console.log('cancelValue', cancelValue);
    });
    describe("DirectSell completed", async function () {
        it('Deploy unlimited DirectSell and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(
                0,
                Math.round(now() / 1000),
                0,
                tokenRoot,
                spentToken,
                account1.address));

            let callbacks = await Callback(payload);

            await nft.changeManager(account1, factoryDirectSell.address, account1.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account1);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');
            await tokenWallet2.transfer(spentToken, directSell.address, 0, true, '', transferValue);
            const dSFilled = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSFilled.to.toString()).to.be.eq('3');

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account2.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account2.address.toString());

            let owner = (await nft.getInfo()).owner
            expect(owner.toString()).to.be.eq(account2.address.toString());

            let currentFee = new BigNumber(spentToken).div(fee.denominator).times(fee.numerator);
            const expectedAccountBalance = new BigNumber(startBalanceTW1).plus(spentToken).minus(currentFee);
            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            const expectedTWFactoryDSBalance = startBalanceTWfactoryDirectSell.plus(currentFee);
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDSBalance.toString());

            const spentTokenWallet1Balance = await tokenWallet1.balance() as any;
            expect(spentTokenWallet1Balance.toString()).to.be.eq(expectedAccountBalance.toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            startBalanceTW1 = startBalanceTW1 + spentToken - currentFee.toNumber();
            startBalanceTW2 -= spentToken;
            startBalanceTWfactoryDirectSell = startBalanceTWfactoryDirectSell.plus(currentFee);
        });
        it('Deploy limited DirectSell and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(
                0,
                Math.round(now() / 1000),
                5,
                tokenRoot,
                spentToken,
                account2.address,
                discountCollection.address,
                nftId
            ));

            let callbacks = await Callback(payload);

            await nft.changeManager(account2, factoryDirectSell.address, account2.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account2);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            let discountFee = (await directSell.contract.methods.marketFee().call()).value0;
            expect(discountInfo.numerator).to.be.eq(discountFee.numerator);
            expect(discountInfo.denominator).to.be.eq(discountFee.denominator);

            await tokenWallet3.transfer(spentToken, directSell.address, 0, true, '', transferValue);
            const dSFilled = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSFilled.to.toString()).to.be.eq('3');

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            let owner = (await nft.getInfo()).owner
            expect(owner.toString()).to.be.eq(account3.address.toString());

            let currentFee = new BigNumber(spentToken).div(discountInfo.denominator).times(discountInfo.numerator);
            const expectedAccountBalance = new BigNumber(startBalanceTW2).plus(spentToken).minus(currentFee);
            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            const expectedTWFactoryDSBalance = startBalanceTWfactoryDirectSell.plus(currentFee);
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDSBalance.toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq(expectedAccountBalance.toString());

            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            startBalanceTW2 = startBalanceTW2 + spentToken - currentFee.toNumber();
            startBalanceTW3 -= spentToken;
            startBalanceTWfactoryDirectSell = startBalanceTWfactoryDirectSell.plus(currentFee);

        });
        it('Deploy limited DirectSell and try to buy before start', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(0,
                Math.round(now() / 1000) + 10,
                10,
                tokenRoot,
                spentToken,
                account3.address
            ));
            let callbacks = await Callback(payload);

            await nft.changeManager(account3, factoryDirectSell.address, account3.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account3);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            await tokenWallet2.transfer(spentToken, directSell.address, 0, true, '', transferValue);
            const dsStillActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dsStillActive.to.toString()).to.be.eq('2');

            let manager = (await nft.getInfo()).manager
            expect(manager.toString()).to.be.eq(directSell.address.toString());

            await tryIncreaseTime(10);
            await tokenWallet2.transfer(spentToken, directSell.address, 0, true, '', transferValue);
            directSell = await DirectSell.from_addr(dSCreate.directSell, account3);
            const dSFilled = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSFilled.to.toString()).to.be.eq('3');

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account2.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account2.address.toString());

            let owner = (await nft.getInfo()).owner
            expect(owner.toString()).to.be.eq(account2.address.toString());

            let currentFee = new BigNumber(spentToken).div(fee.denominator).times(fee.numerator);
            const expectedAccountBalance = new BigNumber(startBalanceTW3).plus(spentToken).minus(currentFee);
            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            const expectedTWFactoryDSBalance = startBalanceTWfactoryDirectSell.plus(currentFee);
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDSBalance.toString());

            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq(expectedAccountBalance.toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            startBalanceTW3 = startBalanceTW3 + spentToken - currentFee.toNumber();
            startBalanceTW2 -= spentToken;
            startBalanceTWfactoryDirectSell = startBalanceTWfactoryDirectSell.plus(currentFee);
        });
        it('Deploy unlimited DirectSell and try to buy before start', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            let startTime = Math.round(now() / 1000) + 10
            payload = (await factoryDirectSell.buildPayload(
                0,
                startTime,
                0,
                tokenRoot,
                spentToken,
                account2.address,
                discountCollection.address,
                nftId
            ));
            let callbacks = await Callback(payload);

            await nft.changeManager(account2, factoryDirectSell.address, account2.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account2);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            await tokenWallet3.transfer(spentToken, directSell.address, 0, true, '', transferValue);
            const dsStillActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dsStillActive.to.toString()).to.be.eq('2');

            let owner = (await nft.getInfo()).owner
            expect(owner.toString()).to.be.eq(account2.address.toString());

            await tryIncreaseTime(15);
            await tokenWallet3.transfer(spentToken, directSell.address, 0, true, '', transferValue);
            directSell = await DirectSell.from_addr(dSCreate.directSell, account3);
            const dSFilled = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSFilled.to.toString()).to.be.eq('3');

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            owner = (await nft.getInfo()).owner
            expect(owner.toString()).to.be.eq(account3.address.toString());

            let currentFee = new BigNumber(spentToken).div(discountInfo.denominator).times(discountInfo.numerator);
            const expectedAccountBalance = new BigNumber(startBalanceTW2).plus(spentToken).minus(currentFee);
            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            const expectedTWFactoryDSBalance = startBalanceTWfactoryDirectSell.plus(currentFee);
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDSBalance.toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq(expectedAccountBalance.toString());

            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            startBalanceTW2 = startBalanceTW2 + spentToken - currentFee.toNumber();
            startBalanceTW3 -= spentToken;
            startBalanceTWfactoryDirectSell = startBalanceTWfactoryDirectSell.plus(currentFee);
        });
    });
    describe("DirectSell cancel", async function () {
        it('Deploy DirectSell and cancel', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(
                0,
                Math.round(now() / 1000),
                0,
                tokenRoot,
                spentToken,
                account3.address));

            let callbacks = await Callback(payload);

            await nft.changeManager(account3, factoryDirectSell.address, account3.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account3);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            await directSell.closeSell(0, cancelValue);
            const dSClosed = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSClosed.to.toString()).to.be.eq('4');

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            let owner = (await nft.getInfo()).owner
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2).toString());
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3).toString());
            expect(owner.toString()).to.be.eq(account3.address.toString());
        });
        it('Deploy DirectSell and cancel before start', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(
                0,
                Math.round((now() / 1000) + 5000),
                0,
                tokenRoot,
                spentToken,
                account3.address));

            let callbacks = await Callback(payload);

            await nft.changeManager(account3, factoryDirectSell.address, account3.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account3);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            await directSell.closeSell(0, cancelValue);
            const dSClosed = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSClosed.to.toString()).to.be.eq('4');

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            let owner = (await nft.getInfo()).owner
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2).toString());
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3).toString());
            expect(owner.toString()).to.be.eq(account3.address.toString());
        });
        it('Deploy DirectSell with duration and cancel', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(
                0,
                Math.round((now() / 1000)),
                50,
                tokenRoot,
                spentToken,
                account3.address));
            //await sleep(10000);

            let callbacks = await Callback(payload);

            await nft.changeManager(account3, factoryDirectSell.address, account3.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account3);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            await directSell.closeSell(0, cancelValue);
            const dSClosed = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSClosed.to.toString()).to.be.eq('4');

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            let owner = (await nft.getInfo()).owner
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2).toString());
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3).toString());
            expect(owner.toString()).to.be.eq(account3.address.toString());
        });
        it('Deploy DirectSell and timeout', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(
                0,
                Math.round((now() / 1000)),
                10,
                tokenRoot,
                spentToken,
                account3.address
            ));

            let callbacks = await Callback(payload);
            await nft.changeManager(account3, factoryDirectSell.address, account3.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            let manager = (await nft.getInfo()).manager;
            expect(manager.toString()).to.be.eq(dSCreate.directSell.toString());

            directSell = await DirectSell.from_addr(dSCreate.directSell, account3);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            await tryIncreaseTime(10);
            await directSell.closeSell(0, cancelValue);
            const dSClosed = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSClosed.to.toString()).to.be.eq('4');

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            let owner = (await nft.getInfo()).owner;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2).toString());
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3).toString());
            expect(owner.toString()).to.be.eq(account3.address.toString());
        });
        it('Deploy DirectSell and try to but after its closed', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(
                0,
                Math.round((now() / 1000)),
                5,
                tokenRoot,
                spentToken,
                account3.address
            ));

            let callbacks = await Callback(payload);

            await nft.changeManager(account3, factoryDirectSell.address, account3.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account3);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            await directSell.closeSell(0, cancelValue);
            const dSClosed = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSClosed.to.toString()).to.be.eq('4');

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            await tokenWallet2.transfer(spentToken, directSell.address, 0, true, '', transferValue);
            let owner = (await nft.getInfo()).owner
            expect(owner.toString()).to.be.eq(account3.address.toString());
            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2).toString());
        });
        it('Deploy DirectSell and expire by timeout', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(
                0,
                Math.round((now() / 1000)),
                10,
                tokenRoot,
                spentToken,
                account3.address
            ));

            let callbacks = await Callback(payload);
            await nft.changeManager(account3, factoryDirectSell.address, account3.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account3);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            await tryIncreaseTime(10);
            await directSell.finishSell(account3, 0, cancelValue);
            const dSClosed = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSClosed.to.toString()).to.be.eq('5');

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            let owner = (await nft.getInfo()).owner
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2).toString());
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3).toString());
            expect(owner.toString()).to.be.eq(account3.address.toString());
        });
        it('Deploy DirectSell and expire by token transfer', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(
                0,
                Math.round((now() / 1000)),
                10,
                tokenRoot,
                spentToken,
                account3.address
            ));

            let callbacks = await Callback(payload);
            await nft.changeManager(account3, factoryDirectSell.address, account3.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account3);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            await tryIncreaseTime(10);
            await tokenWallet2.transfer(spentToken, directSell.address, 0, true, '', transferValue);
            const dSExpired = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSExpired.to.toString()).to.be.eq('5');

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            let owner = (await nft.getInfo()).owner
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2).toString());
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3).toString());
            expect(owner.toString()).to.be.eq(account3.address.toString());
        });
    });
    describe("Change market fee for direct sell", async function () {
        it('Change market fee and success buy', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(
                0,
                Math.round((now() / 1000)),
                10,
                tokenRoot,
                spentToken,
                account3.address
            ));

            let callbacks = await Callback(payload);
            await nft.changeManager(account3, factoryDirectSell.address, account3.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account3);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            let oldFee = (await factoryDirectSell.contract.methods.marketFee().call()).value0;
            expect(oldFee).to.eql(fee);

            let setFee = {
                numerator: '20',
                denominator: '100'
            } as MarketFee;

            await factoryDirectSell.contract.methods.setMarketFeeForChildContract({
                _offer: directSell.address,
                _fee: setFee
            }).send({
                from: account1.address,
                amount: toNano(2)
            });

            let newFee = (await directSell.contract.methods.marketFee().call()).value0;
            expect(setFee.numerator).to.be.eq(newFee.numerator);
            expect(setFee.denominator).to.be.eq(newFee.denominator);

            const dBMFChanged = await factoryDirectSell.getEvent('MarketFeeChanged') as any;
            expect(dBMFChanged.fee).to.be.not.null;

            await tryIncreaseTime(5);
            await tokenWallet2.transfer(spentToken, directSell.address, 0, true, '', transferValue);

            const dSFilles = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSFilles.to.toString()).to.be.eq('3');

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account2.address.toString());

            let currentFee = new BigNumber(spentToken).div(newFee.denominator).times(newFee.numerator);
            const expectedAccountBalance = new BigNumber(startBalanceTW3).plus(spentToken).minus(currentFee);
            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            const expectedTWFactoryDSBalance = startBalanceTWfactoryDirectSell.plus(currentFee);
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDSBalance.toString());

            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq(expectedAccountBalance.toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            let owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq(account2.address.toString());

            startBalanceTW3 = startBalanceTW3 + spentToken - currentFee.toNumber();
            startBalanceTW2 -= spentToken;
            startBalanceTWfactoryDirectSell = startBalanceTWfactoryDirectSell.plus(currentFee);
        });
    });
    describe("Change market fee for factory", async function () {
        it('Change market fee', async function () {
            let oldFee = (await factoryDirectSell.contract.methods.marketFee().call()).value0;
            expect(oldFee).to.eql(fee);

            let setFee = {
                numerator: '20',
                denominator: '100'
            } as MarketFee;

            await factoryDirectSell.contract.methods.setMarketFee({_fee: setFee}).send({
                from: account1.address,
                amount: toNano(2)
            });

            let newFee = (await factoryDirectSell.contract.methods.marketFee().call()).value0;
            expect(setFee.numerator).to.eql(newFee.numerator);
            expect(setFee.denominator).to.eql(newFee.denominator);
            fee = newFee;
        });
        it('Change market fee with zero denominator', async function () {
            let oldFee = (await factoryDirectSell.contract.methods.marketFee().call()).value0;
            expect(oldFee).to.eql(fee);

            let setFee = {
                numerator: '20',
                denominator: '0'
            } as MarketFee;

            await factoryDirectSell.contract.methods.setMarketFee({_fee: setFee}).send({
                from: account1.address,
                amount: toNano(2)
            });
            let newFee = (await factoryDirectSell.contract.methods.marketFee().call()).value0;
            expect(newFee).to.eql(oldFee);
        });
        it('Change market fee not owner', async function () {
            let oldFee = (await factoryDirectSell.contract.methods.marketFee().call()).value0;
            expect(oldFee).to.eql(fee);

            let setFee = {
                numerator: '30',
                denominator: '100'
            } as MarketFee;

            await factoryDirectSell.contract.methods.setMarketFee({_fee: setFee}).send({
                from: account2.address,
                amount: toNano(2)
            });
            let newFee = (await factoryDirectSell.contract.methods.marketFee().call()).value0;
            expect(newFee).to.eql(oldFee);
        });
    });
    describe("Withdraw", async function () {
        it('Trying withdraw not owner', async function () {
            const withdrawAmount = 100000000;

            await factoryDirectSell.withdraw(
                factoryDirectSellTW.address,
                withdrawAmount,
                account2.address,
                account2.address,
                account2.address
            );

            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectSell.toString());
            let spentTokenWallet2Balance = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());
        });
        it('Trying withdraw part of token', async function () {
            const withdrawAmount = 100000000;
            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            console.log(factoryDSTokenWalletBalance);
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectSell.toString());
            let spentTokenWallet2Balance = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());

            await factoryDirectSell.withdraw(
                factoryDirectSellTW.address,
                withdrawAmount,
                account2.address,
                account1.address,
                account1.address
            );

            const factoryDSTokenWalletBalance1 = await factoryDirectSellTW.balance();
            expect(factoryDSTokenWalletBalance1.toString()).to.be.eq((startBalanceTWfactoryDirectSell.minus(new BigNumber(withdrawAmount))).toString());
            let spentTokenWallet2Balance1 = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance1.toString()).to.be.eq((startBalanceTW2 + withdrawAmount).toString());

            startBalanceTWfactoryDirectSell = startBalanceTWfactoryDirectSell.minus(new BigNumber(withdrawAmount));
            startBalanceTW2 = startBalanceTW2 + withdrawAmount;
        });
        it('Trying withdraw more then have', async function () {
            const withdrawAmount = 3300000000;
            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectSell.toString());
            let spentTokenWallet2Balance = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());

            await factoryDirectSell.withdraw(
                factoryDirectSellTW.address,
                withdrawAmount,
                account2.address,
                account1.address,
                account1.address
            );

            const factoryDSTokenWalletBalance2 = await factoryDirectSellTW.balance();
            expect(factoryDSTokenWalletBalance2.toString()).to.be.eq((startBalanceTWfactoryDirectSell).toString());
            let spentTokenWallet2Balance1 = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance1.toString()).to.be.eq((startBalanceTW2).toString());
        });
        it('Trying withdraw all rest of token', async function () {
            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectSell.toString());
            let spentTokenWallet2Balance = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());

            const withdrawAmount = factoryDSTokenWalletBalance;

            await factoryDirectSell.withdraw(
                factoryDirectSellTW.address,
                BigNumber(withdrawAmount).toNumber(),
                account2.address,
                account1.address,
                account1.address
            );

            const factoryDSTokenWalletBalance2 = await factoryDirectSellTW.balance();
            console.log(factoryDSTokenWalletBalance2);
            expect(factoryDSTokenWalletBalance2.toString()).to.be.eq((0).toString());
            let spentTokenWallet2Balance1 = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance1.toString()).to.be.eq((new BigNumber(startBalanceTW2).plus(withdrawAmount)).toString());

            startBalanceTWfactoryDirectSell = startBalanceTWfactoryDirectSell.minus(new BigNumber(withdrawAmount));
            startBalanceTW2 = (new BigNumber(startBalanceTW2).plus(withdrawAmount)).toNumber();
        });
    });

    describe("Integration with Venom Burn", async function () {
        it('Change market burn fee', async function () {

            burnFee = {
                numerator: '20',
                denominator: '100',
                project: factoryDirectSell.address,
                burnRecipient: account4.address
            } as MarketBurnFee

            await factoryDirectSell.contract.methods.setMarketBurnFee({_fee: burnFee}).send({
                from: account1.address,
                amount: toNano(2)
            });

            let newFee = (await factoryDirectSell.contract.methods.marketBurnFee().call()).value0;
            expect(burnFee.numerator).to.eql(newFee?.numerator);
            expect(burnFee.denominator).to.eql(newFee?.denominator);

        });
        it('Change market burn fee with zero denominator', async function () {
            let oldFee = (await factoryDirectSell.contract.methods.marketBurnFee().call()).value0;
            expect(JSON.stringify(oldFee)).to.eql(JSON.stringify(burnFee));

            let setFee = {
                numerator: '20',
                denominator: '0',
                project: factoryDirectSell.address,
                burnRecipient: account4.address
            } as MarketBurnFee

            await factoryDirectSell.contract.methods.setMarketBurnFee({_fee: setFee}).send({
                from: account1.address,
                amount: toNano(2)
            });
            let newFee = (await factoryDirectSell.contract.methods.marketBurnFee().call()).value0;
            expect(JSON.stringify(newFee)).to.eql(JSON.stringify(oldFee));
        });
        it('Change market burn fee not owner', async function () {
            let oldFee = (await factoryDirectSell.contract.methods.marketBurnFee().call()).value0;
            expect(JSON.stringify(oldFee)).to.eql(JSON.stringify(burnFee));

            let setFee = {
                numerator: '30',
                denominator: '100',
                project: factoryDirectSell.address,
                burnRecipient: account4.address
            } as MarketBurnFee

            await factoryDirectSell.contract.methods.setMarketBurnFee({_fee: setFee}).send({
                from: account2.address,
                amount: toNano(2)
            });
            let newFee = (await factoryDirectSell.contract.methods.marketBurnFee().call()).value0;
            expect(JSON.stringify(newFee)).to.eql(JSON.stringify(oldFee));
        });
        it('Deploy limited DirectSell and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(
                0,
                Math.round(now() / 1000),
                5,
                tokenRoot,
                spentToken,
                account2.address,
                discountCollection.address,
                nftId
            ));

            let callbacks = await Callback(payload);

            await nft.changeManager(account2, factoryDirectSell.address, account2.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account2);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            let discountFee = (await directSell.contract.methods.marketFee().call()).value0;
            expect(discountInfo.numerator).to.be.eq(discountFee.numerator);
            expect(discountInfo.denominator).to.be.eq(discountFee.denominator);

            await tokenWallet3.transfer(spentToken, directSell.address, 0, true, '', transferValue);
            const dSFilled = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSFilled.to.toString()).to.be.eq('3');

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            let owner = (await nft.getInfo()).owner
            expect(owner.toString()).to.be.eq(account3.address.toString());

            let currentFee = new BigNumber(spentToken).div(discountInfo.denominator).times(discountInfo.numerator);
            let currentBurnFee = new BigNumber(currentFee).div(burnFee.denominator).times(burnFee.numerator);

            const expectedAccountBalance = new BigNumber(startBalanceTW2).plus(spentToken).minus(currentFee);
            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            const expectedTWFactoryDSBalance = startBalanceTWfactoryDirectSell.plus(currentFee);
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDSBalance.minus(currentBurnFee).toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq(expectedAccountBalance.toString());

            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            startBalanceTW2 = startBalanceTW2 + spentToken - currentFee.toNumber();
            startBalanceTW3 -= spentToken;
            startBalanceTWfactoryDirectSell = startBalanceTWfactoryDirectSell.plus(currentFee).minus(currentBurnFee);
        });
    });
    describe("Testing Royalty", async function () {
        it('Deploy NFT-Collection and Mint Nft with Royalty', async function () {
            let accForNft: Account[] = [];
            setRoyalty = {
                numerator: "5",
                denominator: "100",
                receiver: account4.address
            } as Royalty
            accForNft.push(account2);
            const [collection, nftS] = await deployCollectionAndMintNftWithRoyalty(account2, 1, "nft_to_address.json", accForNft, setRoyalty);
            nft = nftS[0];
            locklift.tracing.setAllowedCodesForAddress(collection.address, {compute: [60]});
            locklift.tracing.setAllowedCodesForAddress(nft.address, {compute: [60]});
        });
        it('Deploy limited DirectSell and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(
                0,
                Math.round(now() / 1000),
                5,
                tokenRoot,
                spentToken,
                account2.address,
                discountCollection.address,
                nftId
            ));

            let callbacks = await Callback(payload);
            const spentTokenWallet4StartBalance = new BigNumber(await tokenWallet4.balance());

            await nft.changeManager(account2, factoryDirectSell.address, account2.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account2);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            let discountFee = (await directSell.contract.methods.marketFee().call()).value0;
            expect(discountInfo.numerator).to.be.eq(discountFee.numerator);
            expect(discountInfo.denominator).to.be.eq(discountFee.denominator);

            await tokenWallet3.transfer(spentToken, directSell.address, 0, true, '', transferValue);
            const dSFilled = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSFilled.to.toString()).to.be.eq('3');

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            let owner = (await nft.getInfo()).owner
            expect(owner.toString()).to.be.eq(account3.address.toString());

            let currentFee = new BigNumber(spentToken).div(discountInfo.denominator).times(discountInfo.numerator);
            let currentBurnFee = new BigNumber(currentFee).div(burnFee.denominator).times(burnFee.numerator);
            let currentRoyaltyFee = new BigNumber(spentToken).div(setRoyalty.denominator).times(setRoyalty.numerator);

            const RoyaltyWithdrawn = await directSell.getEvent("RoyaltyWithdrawn") as any;
            expect(RoyaltyWithdrawn.recipient.toString()).to.be.eq(account4.address.toString())
            expect(RoyaltyWithdrawn.amount.toString()).to.be.eq(currentRoyaltyFee.toString())
            expect(RoyaltyWithdrawn.paymentToken.toString()).to.be.eq(tokenRoot.address.toString())

            const spentTokenWallet4EndBalance = new BigNumber(await tokenWallet4.balance());
            expect((spentTokenWallet4EndBalance.minus(spentTokenWallet4StartBalance)).toString()).to.be.eq(currentRoyaltyFee.toString())

            const expectedAccountBalance = new BigNumber(startBalanceTW2).plus(spentToken).minus(currentFee);
            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            const expectedTWFactoryDSBalance = startBalanceTWfactoryDirectSell.plus(currentFee);
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDSBalance.minus(currentBurnFee).toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq(expectedAccountBalance.minus(currentRoyaltyFee).toString());

            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            startBalanceTW2 = startBalanceTW2 + spentToken - currentFee.toNumber() - currentRoyaltyFee.toNumber();
            startBalanceTW3 -= spentToken;
            startBalanceTWfactoryDirectSell = startBalanceTWfactoryDirectSell.plus(currentFee).minus(currentBurnFee);
        });
        it('Deploy NFT-Collection with Royalty and Mint Nft', async function () {
            let accForNft: Account[] = [];
            setRoyalty = {
                numerator: "7",
                denominator: "100",
                receiver: account4.address
            } as Royalty
            accForNft.push(account3);
            const [collection, nftS] = await deployCollectionAndMintNftWithRoyalty(account2, 1, "nft_to_address.json", accForNft, setRoyalty, false);
            nft = nftS[0];
            locklift.tracing.setAllowedCodesForAddress(collection.address, {compute: [60]});
            locklift.tracing.setAllowedCodesForAddress(nft.address, {compute: [60]});
        });
        it('Deploy limited DirectSell and try to buy before start', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(0,
                Math.round(now() / 1000) + 10,
                10,
                tokenRoot,
                spentToken,
                account3.address
            ));
            let callbacks = await Callback(payload);
            const spentTokenWallet4StartBalance = new BigNumber(await tokenWallet4.balance());

            await nft.changeManager(account3, factoryDirectSell.address, account3.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account3);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            await tokenWallet2.transfer(spentToken, directSell.address, 0, true, '', transferValue);
            const dsStillActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dsStillActive.to.toString()).to.be.eq('2');

            let manager = (await nft.getInfo()).manager
            expect(manager.toString()).to.be.eq(directSell.address.toString());

            await tryIncreaseTime(10);
            await tokenWallet2.transfer(spentToken, directSell.address, 0, true, '', transferValue);
            directSell = await DirectSell.from_addr(dSCreate.directSell, account3);
            const dSFilled = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSFilled.to.toString()).to.be.eq('3');

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account2.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account2.address.toString());

            let owner = (await nft.getInfo()).owner
            expect(owner.toString()).to.be.eq(account2.address.toString());

            let currentFee = new BigNumber(spentToken).div(fee.denominator).times(fee.numerator);
            let currentBurnFee = new BigNumber(currentFee).div(burnFee.denominator).times(burnFee.numerator);
            let currentRoyaltyFee = new BigNumber(spentToken).div(setRoyalty.denominator).times(setRoyalty.numerator);

            const RoyaltyWithdrawn = await directSell.getEvent("RoyaltyWithdrawn") as any;
            expect(RoyaltyWithdrawn.recipient.toString()).to.be.eq(account4.address.toString())
            expect(RoyaltyWithdrawn.amount.toString()).to.be.eq(currentRoyaltyFee.toString())
            expect(RoyaltyWithdrawn.paymentToken.toString()).to.be.eq(tokenRoot.address.toString())

            const spentTokenWallet4EndBalance = new BigNumber(await tokenWallet4.balance());
            expect((spentTokenWallet4EndBalance.minus(spentTokenWallet4StartBalance)).toString()).to.be.eq(currentRoyaltyFee.toString())

            const expectedAccountBalance = new BigNumber(startBalanceTW3).plus(spentToken).minus(currentFee);
            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            const expectedTWFactoryDSBalance = startBalanceTWfactoryDirectSell.plus(currentFee);
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDSBalance.minus(currentBurnFee).toString());

            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq(expectedAccountBalance.minus(currentRoyaltyFee).toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            startBalanceTW3 = startBalanceTW3 + spentToken - currentFee.toNumber();
            startBalanceTW2 -= spentToken;
            startBalanceTWfactoryDirectSell = startBalanceTWfactoryDirectSell.plus(currentFee);
        });
    });
});
