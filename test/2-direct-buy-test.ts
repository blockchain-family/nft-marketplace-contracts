import { AccountType, CollectionType, deployAccount, deployNFT, deployTokenRoot, deployCollection, deployAuctionRoot, CallbackType, sleep, deployFactoryDirectBuy} from "./utils";
import { NftC } from "./wrappers/nft";
import { Token } from "./wrappers/token";
import { TokenWallet } from "./wrappers/token_wallet";
import { FactoryDirectBuy } from "./wrappers/factoryDirectBuy";
import { DirectBuy } from "./wrappers/DirectBuy";

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

let factoryDirectBuy: FactoryDirectBuy;
let directBuy: DirectBuy;

describe("Test DirectBuy contract", async function() {
    it('Deploy account', async function () {
        account1 = await deployAccount(0, 20);
        account2 = await deployAccount(1, 10);
        account3 = await deployAccount(2, 10);
    });

    it('Deploy NFT-Collection', async function () {
        collection = await deployCollection(account1,);
        logger.log(`Nft Collection address: ${collection.address.toString()}`);
    });

    it('Deploy NFT-s', async function () {
        nft = await deployNFT(account1, collection, "Test name", "Test name NFT", "https://", "https://", account2);
        logger.log(`Nft address: ${nft.address.toString()}`);
    });

    it('Deploy TIP-3 token', async function () {
        tokenRoot = await deployTokenRoot('Test', 'Test', account1);
    });

    it('Mint TIP-3 token to account', async function () {
        tokenWallet1 = await tokenRoot.mint(10000000000, account2);
        tokenWallet2 = await tokenRoot.mint(50000000000, account3);
    });

    it('Deploy FactoryDirectBuy', async function () {
        factoryDirectBuy = await deployFactoryDirectBuy(account1);
        logger.log("");
    });

    describe("DirectBuy completed", async function () {
        it('Deploy DirectBuy and success', async function () {
            let payload: string;
            payload = (await factoryDirectBuy.buildPayload(nft, Math.round(Date.now() / 1000), 30));
            
            await sleep(10000);
            await tokenWallet2.transfer(5000000000, factoryDirectBuy.address, locklift.utils.toNano(0.2), true, payload, locklift.utils.toNano(5));

            const dBCreate = await factoryDirectBuy.getEvent('DirectBuyDeployed') as any;
            directBuy = dBCreate.directBuyAddress;
            logger.log(`Address DirectBuy ${directBuy.address}`);

            const callbacks: CallbackType[] = [];
            await nft.changeManager(account2, directBuy.address, account2.address, callbacks);

            const dbFilled = await directBuy.getEvent('DirectBuyStateChanged') as any;
            expect(dbFilled.to.toString()).to.be.eq('3');

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());
        });
    });

    // describe("DirectBuy cancell", async function() {
        // it('Deploy DirectBuy and success', async function () {

        // });
    // });
});