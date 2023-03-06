import {
    deployAccount,
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
BigNumber.config({EXPONENTIAL_AT: 257});

import {Address, toNano} from "locklift";

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

let startBalance2;
let startBalance3;

let weverVault: Address;
let weverRoot: Token;

type MarketFee = {
    numerator: string;
    denominator: string;
}
let fee: MarketFee;
let factoryDirectBuyTWAddress: Address;
let factoryDirectBuyTW: TokenWallet;
let startBalanceTWfactoryDirectBuy: BigNumber;

type GasValue = {
    fixedValue: string,
    dynamicGas: string;
}
let gasValue: any;
let changeManagerValue: string;
let transferValue: string;
let cancelValue : string;

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

async function balance(account: Account){
    return new BigNumber(await locklift.provider.getBalance(account.address));
}

function calcValue(gas: GasValue, gasK: string){
    const gasPrice = new BigNumber(1).shiftedBy(9).div(gasK);
    return new BigNumber(gas.dynamicGas).times(gasPrice).plus(gas.fixedValue).toNumber();
}

describe("Test DirectBuy contract", async function () {
    it('Deploy account', async function () {
        account1 = await deployAccount(0, 130);
        account2 = await deployAccount(1, 130);
        account3 = await deployAccount(2, 130);
    });
    it('Deploy NFT-Collection and Mint Nft', async function () {
        let accForNft: Account[] = [];
        accForNft.push(account2);

        const [, nftS] = await deployCollectionAndMintNft(account1, 1, "nft_to_address.json", accForNft);
        nft = nftS[0];
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

        let addressTW2 = await tokenRoot.walletAddr(account2.address);
        tokenWallet2 = await TokenWallet.from_addr(addressTW2, account2);
        let amount2 = new BigNumber(startBalanceTW2).plus(gasValue).toString();
        await locklift.provider.sendMessage({
            sender: account2.address,
            recipient: weverVault,
            amount: amount2,
            bounce: false
        });

        let addressTW3 = await tokenRoot.walletAddr(account3.address);
        tokenWallet3 = await TokenWallet.from_addr(addressTW3, account3);
        let amount3 = new BigNumber(startBalanceTW3).plus(gasValue).toString();
        await locklift.provider.sendMessage({
            sender: account3.address,
            recipient: weverVault,
            amount: amount3,
            bounce: false
        });
    });
    it('Deploy FactoryDirectBuy with fee denominator zero', async function () {
        let fee = {
            numerator: '10',
            denominator: '0'
        } as MarketFee;
        const factoryDirectBuyExitCode = await deployFactoryDirectBuy(
            account1, fee, weverVault, weverRoot.address
        ).catch(e => e.transaction.transaction.exitCode);
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
        logger.success('factoryDirectBuyTWAddress', factoryDirectBuyTWAddress);
    });
    it( 'Get market fee',async function () {
        fee = (await factoryDirectBuy.contract.methods.getMarketFee().call()).value0;
    });
    it( 'Get fas value',async function () {
        gasValue = (await factoryDirectBuy.contract.methods.getGasValue().call()).value0;
        console.log(gasValue);
        changeManagerValue =  (calcValue(gasValue.accept, gasValue.gasK) + 200000000).toString();
        transferValue = (calcValue(gasValue.make, gasValue.gasK) + 250000000).toString();
        cancelValue = (calcValue(gasValue.cancel, gasValue.gasK) + 200000000).toString();
        console.log('transferValue',transferValue);
        console.log('changeManagerValue',changeManagerValue);
        console.log('cancelValue',cancelValue);
    });
    describe("DirectBuy completed", async function () {
        it('Deploy limited DirectBuy and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, account3, nft, Math.round(Date.now() / 1000), 5));
            await tokenWallet3.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);
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
            const dBActive = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dBActive.to.toString()).to.be.eq('2');

            startBalance2 = await balance(account2);
            startBalance3 = await balance(account3);

            let callbacks = await Callback(payload);
            const {traceTree} = await nft.changeManager(account2, directBuy.address, account2.address, callbacks, changeManagerValue);
            // await traceTree.beautyPrint();
            // console.log('Gas', new BigNumber(await traceTree?.totalGasUsed()).shiftedBy(-9).toNumber());
            // console.log("balanceChangeInfo");
            // for(let addr in traceTree?.balanceChangeInfo) {
            //     console.log(addr + ": " + traceTree?.balanceChangeInfo[addr].balanceDiff.shiftedBy(-9).toString());
            // }

            const dBFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dBFilled.to.toString()).to.be.eq('3');

            const owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq((account3.address).toString());

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            let currentFee = new BigNumber(spentToken).div(fee.denominator).times(fee.numerator);

            const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
            const expectedTWFactoryDBBalance = startBalanceTWfactoryDirectBuy.plus(currentFee);
            expect(factoryDBTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDBBalance.toString());

            const expectedAccountBalance = startBalance2.plus(spentToken).minus(currentFee).shiftedBy(-9).toNumber();
            const everAccount2Balance = (await balance(account2)).shiftedBy(-9).toNumber();
            expect(everAccount2Balance).to.be.closeTo(expectedAccountBalance, 0.4);

            spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

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

            startBalance2 = await balance(account2);
            startBalance3 = await balance(account3);

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

            const expectedAccountBalance = startBalance3.plus(spentToken).minus(currentFee).shiftedBy(-9).toNumber();
            const everAccount3Balance = (await balance(account3)).shiftedBy(-9).toNumber();
            expect(everAccount3Balance).to.be.closeTo(expectedAccountBalance, 0.4);

            const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
            const expectedTWFactoryDBBalance = startBalanceTWfactoryDirectBuy.plus(currentFee);
            expect(factoryDBTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDBBalance.toString());

            spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            startBalanceTW2 -= spentToken;
            startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.plus(currentFee);
        });
        it('Deploy unlimited DirectBuy and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0,account3, nft, Math.round(Date.now() / 1000), 0));
            await tokenWallet3.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);

            let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);

            directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account3);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            startBalance2 = await balance(account2);
            startBalance3 = await balance(account3);

            sleep(5000);
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

            let currentFee = new BigNumber(spentToken).div(fee.denominator).times(fee.numerator);

            const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
            const expectedTWFactoryDBBalance = startBalanceTWfactoryDirectBuy.plus(currentFee);
            expect(factoryDBTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDBBalance.toString());

            const expectedAccountBalance = startBalance2.plus(spentToken).minus(currentFee).shiftedBy(-9).toNumber();
            const everAccount2Balance = (await balance(account2)).shiftedBy(-9).toNumber();
            expect(everAccount2Balance).to.be.closeTo(expectedAccountBalance, 0.4);

            spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            startBalanceTW3 -= spentToken;
            startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.plus(currentFee);
        });
        it('Deploy future unlimited DirectBuy and success', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0,account2, nft, Math.round(Date.now() / 1000) + 5, 0));
            await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);

            let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);

            directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account3);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            startBalance2 = await balance(account2);
            startBalance3 = await balance(account3);

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

            const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
            const expectedTWFactoryDBBalance = startBalanceTWfactoryDirectBuy.plus(currentFee);
            expect(factoryDBTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDBBalance.toString());

            spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const expectedAccountBalance = startBalance3.plus(spentToken).minus(currentFee).shiftedBy(-9).toNumber();
            const everAccount3Balance = (await balance(account3)).shiftedBy(-9).toNumber();
            expect(everAccount3Balance).to.be.closeTo(expectedAccountBalance, 0.4);

            startBalanceTW2 -= spentToken;
            startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.plus(currentFee);
        });
        it('Deploy future DirectBuy and aborted then success', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, account3, nft, Math.round(Date.now() / 1000) + 5, 8));
            await tokenWallet3.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);

            let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);

            directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account2);
            const dbActive = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbActive.to.toString()).to.be.eq('2');

            let callbacks = await Callback(payload);
            await nft.changeManager(account2, directBuy.address, account2.address, callbacks, changeManagerValue);

            startBalance2 = await balance(account2);
            startBalance3 = await balance(account3);

            const manager = (await nft.getInfo()).manager;
            expect(manager.toString()).to.be.eq((account2.address).toString());

            await sleep(3000);
            const {traceTree} = await nft.changeManager(account2, directBuy.address, account2.address, callbacks, changeManagerValue);
            // console.log('Gas', new BigNumber(await traceTree?.totalGasUsed()).shiftedBy(-9).toNumber());
            // console.log("balanceChangeInfo");
            // for(let addr in traceTree?.balanceChangeInfo) {
            //     console.log(addr + ": " + traceTree?.balanceChangeInfo[addr].balanceDiff.shiftedBy(-9).toString());
            // }

            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('3');

            const owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq((account3.address).toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            let currentFee = new BigNumber(spentToken).div(fee.denominator).times(fee.numerator);

            const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
            const expectedTWFactoryDBBalance = startBalanceTWfactoryDirectBuy.plus(currentFee);
            expect(factoryDBTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDBBalance.toString());

            const expectedAccountBalance = startBalance2.plus(spentToken).minus(currentFee).shiftedBy(-9).toNumber();
            const everAccount2Balance = (await balance(account2)).shiftedBy(-9).toNumber();
            expect(everAccount2Balance).to.be.closeTo(expectedAccountBalance, 0.4);

            spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            startBalanceTW3 -= spentToken;
            startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.plus(currentFee);
        });
    });
    describe("DirectBuy cancel", async function () {
        it('Deploy DirectBuy and cancel', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, account2, nft, Math.round(Date.now() / 1000), 0));

            await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);

            directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account2);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            startBalance2 = await balance(account2);

            await directBuy.closeBuy(0, cancelValue);

            const dbClosed = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbClosed.to.toString()).to.be.eq('4');

            const owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq((account3.address).toString());

            const spentTokenWallet2BalanceEnd = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2BalanceEnd.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const expectedAccountBalance = startBalance2.plus(spentToken).shiftedBy(-9).toNumber();
            const everAccount2Balance = (await balance(account2)).shiftedBy(-9).toNumber();
            expect(everAccount2Balance).to.be.closeTo(expectedAccountBalance, 0.2);

            startBalanceTW2 -= spentToken;
        });
        it('Deploy DirectBuy and timeout', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, account2, nft, Math.round(Date.now() / 1000), 10));

            await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);

            directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account2);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            startBalance2 = await balance(account2);

            await directBuy.closeBuy(0, cancelValue);

            const dbClosed = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbClosed.to.toString()).to.be.eq('4');

            const owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq((account3.address).toString());

            const expectedAccountBalance = startBalance2.plus(spentToken).shiftedBy(-9).toNumber();
            const everAccount2Balance = (await balance(account2)).shiftedBy(-9).toNumber();
            expect(everAccount2Balance).to.be.closeTo(expectedAccountBalance, 0.2);

            const spentTokenWallet2BalanceEnd = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2BalanceEnd.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            startBalanceTW2 -= spentToken;
        });
        it('Deploy DirectBuy and instantly cancel', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, account2, nft, Math.round((Date.now() / 1000) + 11), 5));

            await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);

            directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account2);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            startBalance2 = await balance(account2);

            await directBuy.closeBuy(0, cancelValue);

            const owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq((account3.address).toString())

            const dbClosed = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbClosed.to.toString()).to.be.eq('4');

            const spentTokenWallet2BalanceEnd = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2BalanceEnd.toString()).to.be.eq((startBalanceTW2- spentToken).toString());

            const expectedAccountBalance = startBalance2.plus(spentToken).shiftedBy(-9).toNumber();
            const everAccount2Balance = (await balance(account2)).shiftedBy(-9).toNumber();
            expect(everAccount2Balance).to.be.closeTo(expectedAccountBalance, 0.2);

            startBalanceTW2 -= spentToken;
        });
        it('Deploy DirectBuy and expire after sending NFT', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0,account2, nft, Math.round(Date.now() / 1000), 1));
            await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);

            directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account2);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            startBalance2 = await balance(account2);

            await sleep(1000);
            let callbacks = await Callback(payload);
            const  {traceTree} = await nft.changeManager(account3, directBuy.address, account3.address, callbacks, changeManagerValue);
            // console.log('Gas', new BigNumber(await traceTree?.totalGasUsed()).shiftedBy(-9).toNumber());
            // console.log("balanceChangeInfo");
            // for(let addr in traceTree?.balanceChangeInfo) {
            //     console.log(addr + ": " + traceTree?.balanceChangeInfo[addr].balanceDiff.shiftedBy(-9).toString());
            // }

            const dbClosed = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbClosed.to.toString()).to.be.eq('5');

            const owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq((account3.address).toString());

            const spentTokenWallet2BalanceEnd = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2BalanceEnd.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const spentTokenWallet3 = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3.toString()).to.be.eq((startBalanceTW3).toString());

            const expectedAccountBalance = startBalance2.plus(spentToken).shiftedBy(-9).toNumber();
            const everAccount2Balance = (await balance(account2)).shiftedBy(-9).toNumber();
            expect(everAccount2Balance).to.be.closeTo(expectedAccountBalance, 0.1);

            startBalanceTW2 -= spentToken;
        });
        it('Deploy DirectBuy and expire by timeout', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0,account2,  nft, Math.round(Date.now() / 1000), 1));
            await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);

            directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account2);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            startBalance2 = await balance(account2);
            // console.log('startBalance2',startBalance2.shiftedBy(-9).toNumber());

            await sleep(1000);
            const {traceTree} = await directBuy.finishBuy(account3, 0, cancelValue);
            // console.log('Gas', new BigNumber(await traceTree?.totalGasUsed()).shiftedBy(-9).toNumber());
            // console.log("balanceChangeInfo");
            // for(let addr in traceTree?.balanceChangeInfo) {
            // console.log(addr + ": " + traceTree?.balanceChangeInfo[addr].balanceDiff.shiftedBy(-9).toString());
            // }

            const owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq((account3.address).toString());

            const dbClosed = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbClosed.to.toString()).to.be.eq('5');

            const spentTokenWallet2BalanceEnd = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2BalanceEnd.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const expectedAccountBalance = startBalance2.plus(spentToken).shiftedBy(-9).toNumber();
            const everAccount2Balance = (await balance(account2)).shiftedBy(-9).toNumber();
            // console.log('expectedAccountBalance',expectedAccountBalance);
            // console.log('everAccount2Balance',everAccount2Balance);
            expect(everAccount2Balance).to.be.closeTo(expectedAccountBalance, 0.1);

            startBalanceTW2 -= spentToken;
        });
    });
    describe("Change market fee for direct buy", async function () {
        it('Change market fee and success buy', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, account2,  nft, Math.round(Date.now() / 1000), 0));
            await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, toNano(0.1), true, payload, transferValue);

            let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuy.toString()}`);

            directBuy = await DirectBuy.from_addr(dBCreate.directBuy, account3);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            let oldFee = (await factoryDirectBuy.contract.methods.getMarketFee().call()).value0;
            expect(oldFee).to.eql(fee);

            let setFee = {
                numerator: '20',
                denominator: '100'
            } as MarketFee;

            await factoryDirectBuy.contract.methods.setMarketFeeForDirectBuy({directBuy: directBuy.address, _fee: setFee}).send({
                    from: account1.address,
                    amount: toNano(0.5)
            });
                        // console.log('Gas', new BigNumber(await traceTree?.totalGasUsed()).shiftedBy(-9).toNumber());
            // console.log("balanceChangeInfo");
            // for(let addr in traceTree?.balanceChangeInfo) {
            // console.log(addr + ": " + traceTree?.balanceChangeInfo[addr].balanceDiff.shiftedBy(-9).toString());
            // }

            let newFee = (await directBuy.contract.methods.getMarketFee().call()).value0;
            expect(setFee.numerator).to.be.eq(newFee.numerator);
            expect(setFee.denominator).to.be.eq(newFee.denominator);

            const dBMFChanged = await factoryDirectBuy.getEvent('MarketFeeChanged') as any;
            expect(dBMFChanged.fee).to.be.not.null;

            startBalance3 = await balance(account3);
            // console.log('startBalance3', startBalance3.shiftedBy(-9).toNumber());

            sleep(5000);
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

            let currentFee = new BigNumber(spentToken).div(newFee.denominator).times(newFee.numerator);

            const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
            const expectedTWFactoryDBBalance = startBalanceTWfactoryDirectBuy.plus(currentFee);
            expect(factoryDBTokenWalletBalance.toString()).to.be.eq(expectedTWFactoryDBBalance.toString());

            const expectedAccountBalance = startBalance3.plus(spentToken).minus(currentFee).shiftedBy(-9).toNumber();
            const everAccount3Balance = (await balance(account3)).shiftedBy(-9).toNumber();
            // console.log('expectedAccountBalance',expectedAccountBalance);
            // console.log('everAccount3Balance',everAccount3Balance);
            expect(everAccount3Balance).to.be.closeTo(expectedAccountBalance, 0.4);

            spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            startBalanceTW2 -= spentToken;
            startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.plus(currentFee);
        });
    });
    describe("Change market fee for factory", async function () {
        it('Change market fee', async function () {
            let oldFee = (await factoryDirectBuy.contract.methods.getMarketFee().call()).value0;
            expect(oldFee).to.eql(fee);

            let setFee = {
                numerator: '20',
                denominator: '100'
            } as MarketFee;

            await factoryDirectBuy.contract.methods.setMarketFee({_fee: setFee}).send({
                    from: account1.address,
                    amount: toNano(0.5)
            });

            let newFee = (await factoryDirectBuy.contract.methods.getMarketFee().call()).value0;
            expect(setFee.numerator).to.eql(newFee.numerator);
            expect(setFee.denominator).to.eql(newFee.denominator);
            fee = newFee;
        });
        it('Change market fee with zero denominator', async function () {
            let oldFee = (await factoryDirectBuy.contract.methods.getMarketFee().call()).value0;
            expect(oldFee).to.eql(fee);

            let setFee = {
                numerator: '20',
                denominator: '0'
            } as MarketFee;

            await factoryDirectBuy.contract.methods.setMarketFee({_fee: setFee}).send({
                    from: account1.address,
                    amount: toNano(0.5)
            });
            let newFee = (await factoryDirectBuy.contract.methods.getMarketFee().call()).value0;
            expect(newFee).to.eql(oldFee);
        });
        it('Change market fee not owner', async function () {
            let oldFee = (await factoryDirectBuy.contract.methods.getMarketFee().call()).value0;
            expect(oldFee).to.eql(fee);

            let setFee = {
                numerator: '30',
                denominator: '100'
            } as MarketFee;

            await factoryDirectBuy.contract.methods.setMarketFee({_fee: setFee}).send({
                    from: account2.address,
                    amount: toNano(0.5)
            });
            let newFee = (await factoryDirectBuy.contract.methods.getMarketFee().call()).value0;
            expect(newFee).to.eql(oldFee);
        });
    });
    describe("Withdraw", async function () {
        it('Trying withdraw not owner', async function () {
            const withdrawAmount = 1000000000;

            await factoryDirectBuy.contract.methods.withdraw({
                tokenWallet:factoryDirectBuyTW.address,
                amount:withdrawAmount,
                recipient:account2.address,
                remainingGasTo:account2.address}).send({
                    from: account2.address,
                    amount: toNano(1)
                });

            const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
            expect(factoryDBTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectBuy.toString());
            let spentTokenWallet2Balance = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());
        });
        it('Trying withdraw part of token', async function () {
            const withdrawAmount = 1000000000;
            const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
            console.log(factoryDBTokenWalletBalance);
            expect(factoryDBTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectBuy.toString());
            let spentTokenWallet2Balance = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());

            await factoryDirectBuy.contract.methods.withdraw({
                tokenWallet:factoryDirectBuyTW.address,
                amount:withdrawAmount,
                recipient:account2.address,
                remainingGasTo:account1.address}).send({
                    from: account1.address,
                    amount: toNano(1)
                });

            const factoryDBTokenWalletBalance1 = await factoryDirectBuyTW.balance();
            expect(factoryDBTokenWalletBalance1.toString()).to.be.eq((startBalanceTWfactoryDirectBuy.minus(new BigNumber(withdrawAmount))).toString());
            let spentTokenWallet2Balance1 = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance1.toString()).to.be.eq((startBalanceTW2 + withdrawAmount).toString());

            startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.minus(new BigNumber(withdrawAmount));
            startBalanceTW2 = startBalanceTW2 + withdrawAmount;
        });
        it('Trying withdraw more then have', async function () {
            const withdrawAmount = 3300000000;
            const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
            expect(factoryDBTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectBuy.toString());
            let spentTokenWallet2Balance = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());

            await factoryDirectBuy.contract.methods.withdraw({
                tokenWallet:factoryDirectBuyTW.address,
                amount:withdrawAmount,
                recipient:account2.address,
                remainingGasTo:account1.address}).send({
                    from: account1.address,
                    amount: toNano(1)
                });

            const factoryDBTokenWalletBalance2 = await factoryDirectBuyTW.balance();
            expect(factoryDBTokenWalletBalance2.toString()).to.be.eq((startBalanceTWfactoryDirectBuy).toString());
            let spentTokenWallet2Balance1 = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance1.toString()).to.be.eq((startBalanceTW2).toString());
        });
        it('Trying withdraw all rest of token', async function () {
            const factoryDBTokenWalletBalance = await factoryDirectBuyTW.balance();
            expect(factoryDBTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectBuy.toString());
            let spentTokenWallet2Balance = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());

            const withdrawAmount = factoryDBTokenWalletBalance;

            await factoryDirectBuy.contract.methods.withdraw({
                tokenWallet:factoryDirectBuyTW.address,
                amount: withdrawAmount,
                recipient:account2.address,
                remainingGasTo:account1.address}).send({
                    from: account1.address,
                    amount: toNano(1)
                });

            const factoryDBTokenWalletBalance2 = await factoryDirectBuyTW.balance();
            expect(factoryDBTokenWalletBalance2.toString()).to.be.eq((0).toString());
            let spentTokenWallet2Balance1 = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance1.toString()).to.be.eq((new BigNumber(startBalanceTW2).plus(withdrawAmount)).toString());

            startBalanceTWfactoryDirectBuy = startBalanceTWfactoryDirectBuy.minus(new BigNumber(withdrawAmount));
            startBalanceTW2 = (new BigNumber(startBalanceTW2).plus(withdrawAmount)).toNumber();
        });
    });
});
