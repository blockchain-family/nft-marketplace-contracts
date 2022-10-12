import { AccountType, CollectionType, deployAccount, deployTokenRoot, deployCollectionAndMintNft, CallbackType, sleep, deployFactoryDirectBuy} from "./utils";
import { FactoryDirectBuy, DirectBuy } from "./wrappers/directbuy";
import { NftC } from "./wrappers/nft";
import { Token } from "./wrappers/token";
import { TokenWallet } from "./wrappers/token_wallet";

const logger = require('mocha-logger');
const { expect } = require('chai');

let account1: AccountType;
let account2: AccountType;
let account3: AccountType;

let collection: CollectionType;
let nft: NftC;

let tokenRoot: Token;
let tokenWallet1: TokenWallet;
let tokenWallet2: TokenWallet;
let tokenWallet3: TokenWallet;

let factoryDirectBuy: FactoryDirectBuy;
let directBuy: DirectBuy;

let startBalanceTW1: number = 90000000000;
let startBalanceTW2: number = 90000000000;
let startBalanceTW3: number = 90000000000;

async function Callback(payload:string) {
    let callback: CallbackType;
    callback = [
        directBuy.address,
        {
            value: locklift.utils.toNano(2),
            payload: '',
        },
    ];
    const callbacks: CallbackType[] = [];
    callbacks.push(callback);
    return callbacks;
};

describe("Test DirectBuy contract", async function() {
    it('Deploy account', async function () {
        account1 = await deployAccount(0, 30);
        account2 = await deployAccount(1, 60);
        account3 = await deployAccount(2, 60);
    });

    it('Deploy NFT-Collection and Mint Nft', async function () {
        let accForNft:AccountType[] = [];
        accForNft.push(account2);

        const [collection, nftS] = await deployCollectionAndMintNft(account1, 1, "nft_to_address.json", accForNft);
        nft = nftS[0];
    });

    it('Deploy TIP-3 token', async function () {
        tokenRoot = await deployTokenRoot('Test', 'Test', account1);
    });

    it('Mint TIP-3 token to account', async function () {
        tokenWallet1 = await tokenRoot.mint(startBalanceTW1, account1);
        tokenWallet2 = await tokenRoot.mint(startBalanceTW2, account2);
        tokenWallet3 = await tokenRoot.mint(startBalanceTW3, account3);
    });

    it('Deploy FactoryDirectBuy', async function () {
        factoryDirectBuy = await deployFactoryDirectBuy(account1);
        logger.log("");
    });

    describe("DirectBuy completed", async function () {
        /*it('Deploy DirectBuy and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, nft, Math.round(Date.now() / 1000), 5));
            
            await sleep(1000);
            await tokenWallet3.transfer(spentToken, factoryDirectBuy.address, locklift.utils.toNano(0.2), true, payload, locklift.utils.toNano(5));
            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuyAddress.toString()}`);
            
            directBuy = await DirectBuy.from_addr(dBCreate.directBuyAddress, account3);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            let callbacks = await Callback(payload); 
            await nft.changeManager(account2, directBuy.address, account2.address, callbacks);
            const dBFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dBFilled.to.toString()).to.be.eq('3');

            await sleep(5000);
            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            const owner = (await nft.getInfo()).owner;

            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 + spentToken).toString());
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());
            expect(owner.toString()).to.be.eq((account3.address).toString());

            startBalanceTW2 += spentToken;
            startBalanceTW3 -= spentToken;
            
            logger.log("");
        });
        it('Deploy future DirectBuy and success', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, nft, Math.round(Date.now() / 1000)+ 5, 8));
            await sleep(5000);
            await tokenWallet2.transfer(spentToken, factoryDirectBuy.address, locklift.utils.toNano(0.2), true, payload, locklift.utils.toNano(5));
            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuyAddress.toString()}`);
            
            directBuy = await DirectBuy.from_addr(dBCreate.directBuyAddress, account3);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            let callbacks = await Callback(payload); 
            await nft.changeManager(account3, directBuy.address, account3.address, callbacks);
            const dBFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dBFilled.to.toString()).to.be.eq('3');

            await sleep(8000);
            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account2.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account2.address.toString());

            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            const owner = (await nft.getInfo()).owner;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 + spentToken).toString());
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());
            expect(owner.toString()).to.be.eq((account2.address).toString());

            startBalanceTW3 += spentToken;
            startBalanceTW2 -= spentToken;
            
            logger.log("");

        });*/
        it('Deploy future DirectBuy and aborted then success', async function () {
            //Хочу проверить, что раньбше времени нельзя совершить прямую покупку, а потом можно
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, nft, Math.round(Date.now() / 1000)+ 10, 8));
            await sleep(1000);
            await tokenWallet3.transfer(spentToken, factoryDirectBuy.address, locklift.utils.toNano(0.2), true, payload, locklift.utils.toNano(5));
            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuyAddress.toString()}`);
            
            directBuy = await DirectBuy.from_addr(dBCreate.directBuyAddress, account2);
            const dbActive= await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbActive.to.toString()).to.be.eq('2');

            let callbacks = await Callback(payload); 
            await nft.changeManager(account2, directBuy.address, account2.address, callbacks);
            expect(dbActive.to.toString()).to.be.eq('2');

            await sleep(10000);
            await nft.changeManager(account2, directBuy.address, account2.address, callbacks);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('3');
            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account2.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account2.address.toString());

            const spentTokenWallet2Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 + spentToken).toString());

            startBalanceTW3 += spentToken;
            startBalanceTW2 -= spentToken;
            
            logger.log("");
            
        });
    });

   /*describe("DirectBuy cancel", async function() {
        it('Deploy DirectBuy and cancel', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, nft, Math.round(Date.now() / 1000), 5));
            
            await sleep(1000);
            await tokenWallet3.transfer(spentToken, factoryDirectBuy.address, locklift.utils.toNano(0.2), true, payload, locklift.utils.toNano(5));
            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuyAddress.toString()}`);
            
            directBuy = await DirectBuy.from_addr(dBCreate.directBuyAddress, account3);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            await directBuy.closeBuy();
            const dbClosed = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbClosed.to.toString()).to.be.eq('4');
            
            await sleep(5000);
            const spentTokenWallet3BalanceEnd = await tokenWallet3.balance() as any;
            const owner = (await nft.getInfo()).owner;
            expect(spentTokenWallet3BalanceEnd.toString()).to.be.eq((startBalanceTW3).toString());
            expect(owner.toString()).to.be.eq((account2.address).toString());
        });
        it('Deploy DirectBuy and timeout', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, nft, Math.round(Date.now() / 1000), 10)); 
            await sleep(1000);
            await tokenWallet3.transfer(spentToken, factoryDirectBuy.address, locklift.utils.toNano(0.2), true, payload, locklift.utils.toNano(5));
            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuyAddress.toString()}`);
            
            directBuy = await DirectBuy.from_addr(dBCreate.directBuyAddress, account3);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');
       
            await sleep(15000);
            await directBuy.closeBuy();
            const dbClosed = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbClosed.to.toString()).to.be.eq('4');
            const spentTokenWallet3BalanceEnd = await tokenWallet3.balance() as any;
            const owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq((account2.address).toString());
            expect(spentTokenWallet3BalanceEnd.toString()).to.be.eq((startBalanceTW3).toString());
            
        });
        it('Deploy DirectBuy and instantly cancel', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(0, nft, Math.round((Date.now() / 1000)+11), 5));
            
            await sleep(1000);
            await tokenWallet3.transfer(spentToken, factoryDirectBuy.address, locklift.utils.toNano(0.2), true, payload, locklift.utils.toNano(5));
            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            logger.log(`Address DirectBuy ${dBCreate.directBuyAddress.toString()}`);
            
            directBuy = await DirectBuy.from_addr(dBCreate.directBuyAddress, account3);
            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('2');

            await directBuy.closeBuy();
            const dbClosed = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbClosed.to.toString()).to.be.eq('4');
            
            await sleep(5000);
            const spentTokenWallet3BalanceEnd = await tokenWallet3.balance() as any;
            const owner = (await nft.getInfo()).owner;
            expect(spentTokenWallet3BalanceEnd.toString()).to.be.eq((startBalanceTW3).toString());
            expect(owner.toString()).to.be.eq((account2.address).toString());

        });
    });*/
});