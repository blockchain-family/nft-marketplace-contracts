import { AccountType, CollectionType, deployAccount, deployTokenRoot, deployAuctionRoot, CallbackType, sleep, deployCollectionAndMintNft } from "./utils";
import { AuctionRoot, Auction } from "./wrappers/auction";
import { NftC } from "./wrappers/nft";
import { Token } from "./wrappers/token";
import { TokenWallet } from "./wrappers/token_wallet";

const logger = require('mocha-logger');
const { expect } = require('chai');

let account1: AccountType;
let account2: AccountType;
let account3: AccountType;
let account4: AccountType;
let account5: AccountType;

let collection: CollectionType;
let nft: NftC;
let nft2: NftC;

let tokenRoot: Token;
let tokenRoot1: Token;
let tokenWallet1: TokenWallet;
let tokenWallet2: TokenWallet;
let tokenWallet3: TokenWallet;
let tokenWallet4: TokenWallet;
let tokenWallet5: TokenWallet;

let auctionRoot: AuctionRoot;
let auction: Auction;

let startBalanceTW1: number = 90000000000;
let startBalanceTW2: number = 90000000000;
let startBalanceTW3: number = 90000000000;
let startBalanceTW4: number = 90000000000;
let startBalanceTW5: number = 90000000000;

async function Callback(payload:string) {
    let callback: CallbackType;
            callback = [
                auctionRoot.address,
                {
                    value: locklift.utils.toNano(5),
                    payload: payload,
                },
            ];

            const callbacks: CallbackType[] = [];
            callbacks.push(callback);
            return(callbacks);
};

describe("Test Auction contract", async function () {

    it('Deploy account', async function () {
        account1 = await deployAccount(0, 20);
        account2 = await deployAccount(1, 30);
        account3 = await deployAccount(2, 60);
        account4 = await deployAccount(3, 20);
        account5 = await deployAccount(4, 20);
    });

    it('Deploy NFT-Collection and Mint Nft', async function () {
        let accForNft: AccountType[] = [];
        accForNft.push(account2);

        const [collection, nftS] = await deployCollectionAndMintNft(account2, 1, "nft_to_address.json", accForNft);
        nft = nftS[0];
    });

    it('Deploy TIP-3 token', async function () {
        tokenRoot = await deployTokenRoot('Test', 'Test', account1);
        tokenRoot1 = await deployTokenRoot('NewToken', 'NewToken', account5);
    });

    it('Mint TIP-3 token to account', async function () {
        tokenWallet1 = await tokenRoot.mint(startBalanceTW1, account1);
        tokenWallet2 = await tokenRoot.mint(startBalanceTW2, account2);
        tokenWallet3 = await tokenRoot.mint(startBalanceTW3, account3);
        tokenWallet4 = await tokenRoot.mint(startBalanceTW4, account4);
        tokenWallet5 = await tokenRoot1.mint(startBalanceTW4, account5);
    });

    it('Deploy AuctionRootTip3', async function () {
        auctionRoot = await deployAuctionRoot(account2);
        logger.log("");
    });

    describe("Auction completed", async function () {
        it('Deploy Auction and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(Date.now() / 1000), 3)).toString();
            let callbacks = await Callback(payload);
            await nft.changeManager(account2, auctionRoot.address, account2.address, callbacks);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;

            auction = await Auction.from_addr(auctionDeployedEvent.offerAddress, account2);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            await tokenWallet3.transfer(spentToken, auction.address, 0, true, '', locklift.utils.toNano(2));
            const spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            const bidPlacedEvent = await auction.getEvent('BidPlaced') as any;
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account3.address.toString());

            await sleep(3000);
            await locklift.tracing.trace(auction.finishAuction(account2));

            const ownerChanged = await  nft.getEvent('OwnerChanged') as any;
            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());
             
            await auction.getEvent('AuctionComplete');

            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            let status = (await auction.getInfo()).status;
            let owner = (await nft.getInfo()).owner;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 + spentToken).toString());
            expect(status.toString()).to.be.eq('2');
            expect(owner.toString()).to.be.eq(account3.address.toString());

            startBalanceTW2 += spentToken;
            startBalanceTW3 -= spentToken;
        });
    });

    describe("Auction cancel from creater", async function () {
        it('Deploy Auction and cancel', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(Date.now() / 1000), 3)).toString();

            let callbacks = await Callback(payload);
            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks);

            let event = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(event.offerAddress, account2);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            await tokenWallet3.transfer(spentToken, auction.address, 0, true, '', locklift.utils.toNano(2));
            let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            await sleep(3000);
            await locklift.tracing.trace(auction.finishAuction(account2));

            event = await nft.getEvent('ManagerChanged');
            expect(event.newManager.toString()).to.be.eq(account3.address.toString());
            await auction.getEvent('AuctionCancelled');
            spentTokenWallet3Balance = await tokenWallet3.balance();

            let status = (await auction.getInfo()).status;
            let owner = (await nft.getInfo()).owner;
            expect(spentTokenWallet3Balance.toString()).to.be.eq(startBalanceTW3.toString());
            expect(status.toString()).to.be.eq('2');
            expect(owner.toString()).to.be.eq(account3.address.toString());
        });
    });

    describe("Auction bidding variants", async function () {
        it('Deploy Auction and several users stake', async function () {
            const spentToken: number = 4000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(Date.now() / 1000), 5)).toString();

            let callbacks = await Callback(payload);

            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;

            auction = await Auction.from_addr(auctionDeployedEvent.offerAddress, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            //First bid placed
            await tokenWallet2.transfer(spentToken, auction.address, 0, true, '', locklift.utils.toNano(2));
            let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            const bidPlacedEvent = await auction.getEvent('BidPlaced') as any;
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account2.address.toString());
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            //Second bid placed
            await tokenWallet4.transfer(spentToken + 10000000000, auction.address, 0, true, '', locklift.utils.toNano(2));
            let spentTokenWallet4Balance = await tokenWallet4.balance() as any;
            const rebidPlacedEvent = await auction.getEvent('BidPlaced') as any;
            expect(rebidPlacedEvent.buyer.toString()).to.be.eq(account4.address.toString());
            expect(spentTokenWallet4Balance.toString()).to.be.eq((startBalanceTW4 - spentToken - 10000000000).toString());

            //Finish auction
            await sleep(5000);
            await locklift.tracing.trace(auction.finishAuction(account2));

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account4.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account4.address.toString());

            await auction.getEvent('AuctionComplete');

            spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            let status = (await auction.getInfo()).status;
            let owner = (await nft.getInfo()).owner;
            expect(status.toString()).to.be.eq('2');
            expect(owner.toString()).to.be.eq(account4.address.toString());
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 + spentToken + 10000000000).toString());
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2).toString());
            expect(spentTokenWallet4Balance.toString()).to.be.eq((startBalanceTW4 - spentToken - 10000000000).toString());

            startBalanceTW3 = startBalanceTW3 + spentToken + 10000000000;
            startBalanceTW4 = startBalanceTW4 - spentToken - 10000000000;
        });
    });

    describe("Auction single rebid", async function () {
        it('Two stake with first user rebid', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(Date.now() / 1000), 5)).toString();

            let callbacks = await Callback(payload);
            await nft.changeManager(account4, auctionRoot.address, account4.address, callbacks);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;

            auction = await Auction.from_addr(auctionDeployedEvent.offerAddress, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);


            //First user bid
            await tokenWallet3.transfer(spentToken, auction.address, 0, true, '', locklift.utils.toNano(2));
            let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            const bidPlacedEvent = await auction.getEvent('BidPlaced') as any;
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account3.address.toString());

            //Second user bid
            await tokenWallet2.transfer(spentToken + 1000000000, auction.address, 0, true, '', locklift.utils.toNano(2));
            let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            const rebidPlacedEvent = await auction.getEvent('BidPlaced') as any;
            expect(rebidPlacedEvent.buyer.toString()).to.be.eq(account2.address.toString());

            //First user rebid
            await tokenWallet3.transfer(spentToken + 2000000000, auction.address, 0, true, '', locklift.utils.toNano(2));
            const newbidPlacedEvent = await auction.getEvent('BidPlaced') as any;
            expect(newbidPlacedEvent.buyer.toString()).to.be.eq(account3.address.toString());

            //Finish auction
            await sleep(5000);
            await locklift.tracing.trace(auction.finishAuction(account2));

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            await auction.getEvent('AuctionComplete');

            let spentTokenWallet4Balance = await tokenWallet4.balance() as any;
            spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            let status = (await auction.getInfo()).status;
            let owner = (await nft.getInfo()).owner;
            expect(status.toString()).to.be.eq('2');
            expect(owner.toString()).to.be.eq(account3.address.toString());
            expect(spentTokenWallet4Balance.toString()).to.be.eq((startBalanceTW4 + spentToken + 2000000000).toString());
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken - 2000000000).toString());
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2).toString());

            startBalanceTW4 = startBalanceTW4 + spentToken + 2000000000;
            startBalanceTW3 = startBalanceTW3 - spentToken - 2000000000;
        });
    });

    describe("Auction negative testing", async function () {
        it('Trying to stake less then auction bid', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round((Date.now() / 1000)), 3)).toString();

            let callbacks = await Callback(payload);

            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;

            auction = await Auction.from_addr(auctionDeployedEvent.offerAddress, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);


            await tokenWallet4.transfer(10000, auction.address, 0, true, '', locklift.utils.toNano(2));
            const bidPlacedEvent = await auction.getEvent('BidDeclined') as any;
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account4.address.toString());

            let status = (await auction.getInfo()).status;
            let owner = (await nft.getInfo()).owner;
            expect(status.toString()).to.be.eq('1');
            expect(owner.toString()).to.be.eq(account3.address.toString());

            await auction.finishAuction(account3);
            await auction.getEvent('AuctionComplete');
        });

        it('Trying to stake after auction closed', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round((Date.now() / 1000)), 3)).toString();

            let callbacks = await Callback(payload);

            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(auctionDeployedEvent.offerAddress, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            await sleep(3000);
            await locklift.tracing.trace(auction.finishAuction(account3));
            await auction.getEvent('AuctionCancelled');

            await tokenWallet1.transfer(spentToken, auction.address, 0, true, '', locklift.utils.toNano(2));
            let spentTokenWallet1Balance = await tokenWallet1.balance() as any;
            const bidPlacedEvent = await auction.getEvent('BidDeclined') as any;

            let status = (await auction.getInfo()).status;
            let owner = (await nft.getInfo()).owner;
            expect(status.toString()).to.be.eq('3');
            expect(owner.toString()).to.be.eq(account3.address.toString());
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account1.address.toString());
            expect(spentTokenWallet1Balance.toString()).to.be.eq((startBalanceTW1).toString());
        });

        it('Trying to stake after auction finished, but not closed', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round((Date.now() / 1000)), 3)).toString();

            let callbacks = await Callback(payload);

            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(auctionDeployedEvent.offerAddress, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            await sleep(3000);

            await tokenWallet1.transfer(spentToken, auction.address, 0, true, '', locklift.utils.toNano(2));
            let spentTokenWallet1Balance = await tokenWallet1.balance() as any;
            const bidPlacedEvent = await auction.getEvent('BidDeclined') as any;

            await locklift.tracing.trace(auction.finishAuction(account3));
            await auction.getEvent('AuctionCancelled');

            let status = (await auction.getInfo()).status;
            let owner = (await nft.getInfo()).owner;
            expect(status.toString()).to.be.eq('3');
            expect(owner.toString()).to.be.eq(account3.address.toString());
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account1.address.toString());
            expect(spentTokenWallet1Balance.toString()).to.be.eq((startBalanceTW1).toString());
        });

        it('Trying to deploy zero duration auction', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round((Date.now() / 1000)), 0)).toString();

            let callbacks = await Callback(payload);

            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(auctionDeployedEvent.offerAddress, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            await auction.finishAuction(account3);
            await auction.getEvent('AuctionCancelled');

            let status = (await auction.getInfo()).status;
            let owner = (await nft.getInfo()).owner;
            expect(status.toString()).to.be.eq('3');
            expect(owner.toString()).to.be.eq(account3.address.toString());
        });

        it('Trying to finish auction afters its closed', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round((Date.now() / 1000)), 3)).toString();

            let callbacks = await Callback(payload);

            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(auctionDeployedEvent.offerAddress, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            await tokenWallet2.transfer(spentToken, auction.address, 0, true, '', locklift.utils.toNano(2));
            let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            const bidPlacedEvent = await auction.getEvent('BidPlaced') as any;
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account2.address.toString());
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            await sleep(3000);
            await locklift.tracing.trace(auction.finishAuction(account2));
            await auction.getEvent('AuctionComplete');

            let status = (await auction.getInfo()).status;
            let owner = (await nft.getInfo()).owner;
            expect(status.toString()).to.be.eq('2');
            expect(owner.toString()).to.be.eq(account2.address.toString());

            await auction.getEvent('AuctionComplete');
            expect(status.toString()).to.be.eq('2');
            expect(owner.toString()).to.be.eq(account2.address.toString());
        });

        it('Trying to stake before auction starts', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round((Date.now() / 1000)) + 2, 3)).toString();

            let callbacks = await Callback(payload);

            await nft.changeManager(account2, auctionRoot.address, account2.address, callbacks);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(auctionDeployedEvent.offerAddress, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            let status = (await auction.getInfo()).status;
            expect(status.toString()).to.be.eq('1');
            await tokenWallet4.transfer(spentToken, auction.address, 0, true, '', locklift.utils.toNano(2));
            const bidPlacedEvent = await auction.getEvent('BidDeclined') as any;
            let spentTokenWallet4Balance = await tokenWallet4.balance() as any;

            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account4.address.toString());
            expect(spentTokenWallet4Balance.toString()).to.be.eq((startBalanceTW4).toString());
            expect(status.toString()).to.be.eq('1');

            await sleep(5000);

            await locklift.tracing.trace(auction.finishAuction(account2));
            await auction.getEvent('AuctionCancelled');

            let owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq(account2.address.toString());
        });

        it('Trying finish auction before its start', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(((Date.now() / 1000)) + 2), 3)).toString();

            let callbacks = await Callback(payload);

            await nft.changeManager(account2, auctionRoot.address, account2.address, callbacks);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(auctionDeployedEvent.offerAddress, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            let status = (await auction.getInfo()).status;
            expect(status.toString()).to.be.eq('1');

            await auction.finishAuction(account2);

            let owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq(account2.address.toString());
            expect(status.toString()).to.be.eq('1');

            await sleep(5000);
            await auction.finishAuction(account2);
            await auction.getEvent('AuctionCancelled');
        });
    });
});
