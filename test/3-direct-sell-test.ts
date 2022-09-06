
import { AccountType, CollectionType, deployAccount, deployTokenRoot, deployCollectionAndMintNft, CallbackType, sleep, deployFactoryDirectSell } from "./utils";
import { NftC } from "./wrappers/nft";
import { Token } from "./wrappers/token";
import { TokenWallet } from "./wrappers/token_wallet";
import { FactoryDirectSell } from "./wrappers/factoryDirectSell";
import { DirectSell } from "./wrappers/DirectSell";

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

let factoryDirectSell: FactoryDirectSell;
let directSell: DirectSell;

let startBalanceTW1: number = 10000000000;
let startBalanceTW2: number = 50000000000;

describe("Test DirectSell contract", async function () {
    it('Deploy account', async function () {
        account1 = await deployAccount(0, 15);
        account2 = await deployAccount(1, 10);
        account3 = await deployAccount(2, 15);
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
        tokenWallet1 = await tokenRoot.mint(startBalanceTW1, account2);
        tokenWallet2 = await tokenRoot.mint(startBalanceTW2, account3);
    });

    it('Deploy FactoryDirectSell', async function () {
        factoryDirectSell = await deployFactoryDirectSell(account1);
        logger.log("");
    });

    describe("DirectSell completed", async function () {
        it('Deploy DirectSell and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await factoryDirectSell.buildPayload(nft, Math.round(Date.now() / 1000), 0, tokenRoot, spentToken));
            await sleep(10000);

            let callback: CallbackType;
            callback = [
                factoryDirectSell.address,
                {
                    value: locklift.utils.toNano(3),
                    payload: payload,
                },
            ];
            const callbacks: CallbackType[] = [];
            callbacks.push(callback);

            await nft.changeManager(account2, factoryDirectSell.address, account2.address, callbacks);
            const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
            logger.log(`Address DirectSell ${dSCreate._directSellAddress.toString()}`);

            directSell = await DirectSell.from_addr(dSCreate._directSellAddress, account2);
            const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSActive.to.toString()).to.be.eq('2');

            await tokenWallet2.transfer(spentToken, directSell.address, 0, true, '', locklift.utils.toNano(2));
            const dSFilled = await directSell.getEvent('DirectSellStateChanged') as any;
            expect(dSFilled.to.toString()).to.be.eq('3');

            await sleep(1000);

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            startBalanceTW1 += spentToken;
            startBalanceTW2 -= spentToken;

            const spentTokenWallet1Balance = await tokenWallet1.balance() as any;
            expect(spentTokenWallet1Balance.toString()).to.be.eq(startBalanceTW1.toString());

            logger.log("");
        });

        describe("DirectSell cancel", async function () {
            it('Deploy DirectSell and cancel', async function () {
                const spentToken: number = 5000000000;
                let payload: string;
                payload = (await factoryDirectSell.buildPayload(nft, Math.round(Date.now() / 1000), 0, tokenRoot, spentToken));
                await sleep(10000);

                let callback: CallbackType;
                callback = [
                    factoryDirectSell.address,
                    {
                        value: locklift.utils.toNano(3),
                        payload: payload,
                    },
                ];
                const callbacks: CallbackType[] = [];
                callbacks.push(callback);

                await nft.changeManager(account3, factoryDirectSell.address, account3.address, callbacks);
                const dSCreate = await factoryDirectSell.getEvent('DirectSellDeployed') as any;
                logger.log(`Address DirectSell ${dSCreate._directSellAddress.toString()}`);

                directSell = await DirectSell.from_addr(dSCreate._directSellAddress, account3);
                const dSActive = await directSell.getEvent('DirectSellStateChanged') as any;
                expect(dSActive.to.toString()).to.be.eq('2');

                await directSell.closeSell();
                const dSClosed = await directSell.getEvent('DirectSellStateChanged') as any;
                expect(dSClosed.to.toString()).to.be.eq('4');
                
                const managerChanged = await nft.getEvent('ManagerChanged') as any;
                expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());
            });
        });
    });
});