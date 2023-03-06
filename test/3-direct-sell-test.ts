
import {
    deployAccount,
    deployTokenRoot,
    deployCollectionAndMintNft,
    CallbackType,
    sleep,
    deployFactoryDirectSell, deployWeverRoot
} from "./utils";
import { Account } from "everscale-standalone-client/nodejs";
import { FactoryDirectSell, DirectSell } from "./wrappers/DirectSell";
import { NftC } from "./wrappers/nft";
import { Token } from "./wrappers/token";
import { TokenWallet } from "./wrappers/token_wallet";
import {Address, toNano} from "locklift";
import {BigNumber} from "bignumber.js";

const logger = require('mocha-logger');
const { expect } = require('chai');

let account1: Account;
let account2: Account;
let account3: Account;

let nft: NftC;

let tokenRoot: Token;
let tokenWallet1: TokenWallet;
let tokenWallet2: TokenWallet;
let tokenWallet3: TokenWallet;

let factoryDirectSell: FactoryDirectSell;
let directSell: DirectSell;

let startBalanceTW1: number = 90000000000;
let startBalanceTW2: number = 90000000000;
let startBalanceTW3: number = 90000000000;

type MarketFee = {
    numerator: string;
    denominator: string;
}
let fee: MarketFee;
let factoryDirectSellTWAddress: Address;
let factoryDirectSellTW: TokenWallet;
let startBalanceTWfactoryDirectSell: BigNumber;

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

async function Callback(payload: string) {
    let callback: CallbackType;
    callback = [
        factoryDirectSell.address,
        {
            value: calcValue(gasValue.sell, gasValue.gasK) .toString(),
            payload: payload,
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

describe("Test DirectSell contract", async function () {
    it('Deploy account', async function () {
        account1 = await deployAccount(0, 30);
        account2 = await deployAccount(1, 30);
        account3 = await deployAccount(2, 30);
    });
    it('Deploy NFT-Collection and Mint Nft', async function () {
        let accForNft: Account[] = [];
        accForNft.push(account1);
        const [, nftS] = await deployCollectionAndMintNft(account1, 1, "nft_to_address.json", accForNft);
        nft = nftS[0];
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
        tokenWallet1 = await tokenRoot.mint(startBalanceTW1, account1);
        tokenWallet2 = await tokenRoot.mint(startBalanceTW2, account2);
        tokenWallet3 = await tokenRoot.mint(startBalanceTW2, account3);
    });
    it('Deploy FactoryDirectSell with fee denominator zero', async function () {
        let fee = {
            numerator: '10',
            denominator: '0'
        } as MarketFee;

        const factoryDirectSellExitCode = await deployFactoryDirectSell(
            account1, fee, weverRoot.address, weverVault
        ).catch(e => e.transaction.transaction.exitCode);
        expect(factoryDirectSellExitCode.toString()).to.be.eq('110');
    });
    it('Deploy FactoryDirectSell', async function () {
        let fee = {
            numerator: '10',
            denominator: '100'
        } as MarketFee;
        factoryDirectSell = await deployFactoryDirectSell(account1, fee, weverRoot.address, weverVault);
        const dSMFChanged = await factoryDirectSell.getEvent('MarketFeeDefaultChanged') as any;
        expect(dSMFChanged.fee).to.be.not.null;
    });
    it('Get address token wallet for FactoryDirectSell', async function () {
        factoryDirectSellTWAddress = await tokenRoot.walletAddr(factoryDirectSell.address);
        factoryDirectSellTW = await TokenWallet.from_addr(factoryDirectSellTWAddress, null);
        startBalanceTWfactoryDirectSell = new BigNumber(await factoryDirectSellTW.balanceSafe());
    });
    it( 'Get market fee',async function () {
        fee = (await factoryDirectSell.contract.methods.getMarketFee().call()).value0;
    });
    it( 'Get fas value',async function () {
        gasValue = (await factoryDirectSell.contract.methods.getGasValue().call()).value0;
        console.log(gasValue);
        changeManagerValue =  (calcValue(gasValue.sell, gasValue.gasK) + 200000000).toString();
        transferValue = (calcValue(gasValue.buy, gasValue.gasK) + 250000000).toString();
        cancelValue = (calcValue(gasValue.cancel, gasValue.gasK) + 200000000).toString();
        console.log('transferValue',transferValue);
        console.log('changeManagerValue',changeManagerValue);
        console.log('cancelValue',cancelValue);
    });
    describe("DirectSell completed", async function () {
        it('Deploy unlimited DirectSell and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(
                0,
                Math.round(Date.now() / 1000),
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
                Math.round(Date.now() / 1000),
                5,
                tokenRoot,
                spentToken,
                account2.address));

            let callbacks = await Callback(payload);

            await nft.changeManager(account2, factoryDirectSell.address, account2.address, callbacks, changeManagerValue);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate.directSell.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate.directSell, account2);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            await tokenWallet3.transfer(spentToken, directSell.address, 0, true, '', transferValue);
            const dSFilled = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSFilled.to.toString()).to.be.eq('3');

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            let owner = (await nft.getInfo()).owner
            expect(owner.toString()).to.be.eq(account3.address.toString());

            let currentFee = new BigNumber(spentToken).div(fee.denominator).times(fee.numerator);
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
                Math.round(Date.now() / 1000) + 10,
                10,
                tokenRoot,
                spentToken,
                account3.address
            ));
            let callbacks = await Callback(payload);

            await nft.changeManager(account3, factoryDirectSell.address, account3.address, callbacks,changeManagerValue);
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

            await sleep(10000);
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
            let startTime = Math.round(Date.now() / 1000) + 10
            payload = (await factoryDirectSell.buildPayload(0,  startTime, 0, tokenRoot, spentToken, account2.address));
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

            await sleep(15000);
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

            let currentFee = new BigNumber(spentToken).div(fee.denominator).times(fee.numerator);
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
                Math.round(Date.now() / 1000),
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
                Math.round((Date.now() / 1000) + 5000),
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
                Math.round((Date.now() / 1000)),
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
                Math.round((Date.now() / 1000)),
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

            await sleep(10000);
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
                Math.round((Date.now() / 1000)),
                5,
                tokenRoot,
                spentToken,
                account3.address
            ));

            let callbacks = await Callback(payload);

            await nft.changeManager(account3, factoryDirectSell.address, account3.address, callbacks,changeManagerValue);
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
                Math.round((Date.now() / 1000)),
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

            await sleep(10000);
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
                Math.round((Date.now() / 1000)),
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

            await sleep(10000);
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
                Math.round((Date.now() / 1000)),
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

            let oldFee = (await factoryDirectSell.contract.methods.getMarketFee().call()).value0;
            expect(oldFee).to.eql(fee);

            let setFee = {
                numerator: '20',
                denominator: '100'
            } as MarketFee;

            await factoryDirectSell.contract.methods.setMarketFeeForDirectSell({directSell: directSell.address, _fee: setFee}).send({
                from: account1.address,
                amount: toNano(2)
            });

            let newFee = (await directSell.contract.methods.getMarketFee().call()).value0;
            expect(setFee.numerator).to.be.eq(newFee.numerator);
            expect(setFee.denominator).to.be.eq(newFee.denominator);

            const dBMFChanged = await factoryDirectSell.getEvent('MarketFeeChanged') as any;
            expect(dBMFChanged.fee).to.be.not.null;

            sleep(5000);
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
            let oldFee = (await factoryDirectSell.contract.methods.getMarketFee().call()).value0;
            expect(oldFee).to.eql(fee);

            let setFee = {
                numerator: '20',
                denominator: '100'
            } as MarketFee;

            await factoryDirectSell.contract.methods.setMarketFee({_fee: setFee}).send({
                    from: account1.address,
                    amount: toNano(2)
            });

            let newFee = (await factoryDirectSell.contract.methods.getMarketFee().call()).value0;
            expect(setFee.numerator).to.eql(newFee.numerator);
            expect(setFee.denominator).to.eql(newFee.denominator);
            fee = newFee;
        });
        it('Change market fee with zero denominator', async function () {
            let oldFee = (await factoryDirectSell.contract.methods.getMarketFee().call()).value0;
            expect(oldFee).to.eql(fee);

            let setFee = {
                numerator: '20',
                denominator: '0'
            } as MarketFee;

            await factoryDirectSell.contract.methods.setMarketFee({_fee: setFee}).send({
                    from: account1.address,
                    amount: toNano(2)
            });
            let newFee = (await factoryDirectSell.contract.methods.getMarketFee().call()).value0;
            expect(newFee).to.eql(oldFee);
        });
        it('Change market fee not owner', async function () {
            let oldFee = (await factoryDirectSell.contract.methods.getMarketFee().call()).value0;
            expect(oldFee).to.eql(fee);

            let setFee = {
                numerator: '30',
                denominator: '100'
            } as MarketFee;

            await factoryDirectSell.contract.methods.setMarketFee({_fee: setFee}).send({
                    from: account2.address,
                    amount: toNano(2)
            });
            let newFee = (await factoryDirectSell.contract.methods.getMarketFee().call()).value0;
            expect(newFee).to.eql(oldFee);
        });
    });
    describe("Withdraw", async function () {
        it('Trying withdraw not owner', async function () {
            const withdrawAmount = 1000000000;

            await factoryDirectSell.contract.methods.withdraw({
                tokenWallet:factoryDirectSellTW.address,
                amount:withdrawAmount,
                recipient:account2.address,
                remainingGasTo:account2.address}).send({
                    from: account2.address,
                    amount: toNano(2)
                });

            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectSell.toString());
            let spentTokenWallet2Balance = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());
        });
        it('Trying withdraw part of token', async function () {
            const withdrawAmount = 1000000000;
            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectSell.toString());
            let spentTokenWallet2Balance = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());

            await factoryDirectSell.contract.methods.withdraw({
                tokenWallet:factoryDirectSellTW.address,
                amount:withdrawAmount,
                recipient:account2.address,
                remainingGasTo:account1.address}).send({
                    from: account1.address,
                    amount: toNano(2)
                });

            const factoryDSTokenWalletBalance1 = await factoryDirectSellTW.balance();
            expect(factoryDSTokenWalletBalance1.toString()).to.be.eq((startBalanceTWfactoryDirectSell.minus(new BigNumber(withdrawAmount))).toString());
            let spentTokenWallet2Balance1 = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance1.toString()).to.be.eq((startBalanceTW2 + withdrawAmount).toString());

            startBalanceTWfactoryDirectSell = startBalanceTWfactoryDirectSell.minus(new BigNumber(withdrawAmount));
            startBalanceTW2 = startBalanceTW2 + withdrawAmount;
        });
        it('Trying withdraw more then have', async function () {
            const withdrawAmount = 2200000000;
            const factoryDSTokenWalletBalance = await factoryDirectSellTW.balance();
            expect(factoryDSTokenWalletBalance.toString()).to.be.eq(startBalanceTWfactoryDirectSell.toString());
            let spentTokenWallet2Balance = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());

            await factoryDirectSell.contract.methods.withdraw({
                tokenWallet:factoryDirectSellTW.address,
                amount:withdrawAmount,
                recipient:account2.address,
                remainingGasTo:account1.address}).send({
                    from: account1.address,
                    amount: toNano(2)
                });

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

            await factoryDirectSell.contract.methods.withdraw({
                tokenWallet:factoryDirectSellTW.address,
                amount: withdrawAmount,
                recipient:account2.address,
                remainingGasTo:account1.address
            }).send({
                    from: account1.address,
                    amount: toNano(2)
                });

            const factoryDSTokenWalletBalance2 = await factoryDirectSellTW.balance();
            expect(factoryDSTokenWalletBalance2.toString()).to.be.eq((0).toString());
            let spentTokenWallet2Balance1 = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance1.toString()).to.be.eq((new BigNumber(startBalanceTW2).plus(withdrawAmount)).toString());

            startBalanceTWfactoryDirectSell = startBalanceTWfactoryDirectSell.minus(new BigNumber(withdrawAmount));
            startBalanceTW2 = (new BigNumber(startBalanceTW2).plus(withdrawAmount)).toNumber();
        });
    });
});
