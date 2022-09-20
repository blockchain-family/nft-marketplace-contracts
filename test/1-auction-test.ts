import { AccountType, CollectionType, deployAccount, deployTokenRoot, deployAuctionRoot, CallbackType, sleep, deployCollectionAndMintNft} from "./utils";
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

let collection: CollectionType;
let nft: NftC;
let nft2: NftC;

let tokenRoot: Token;
let tokenWallet1: TokenWallet;
let tokenWallet2: TokenWallet;
let tokenWallet3: TokenWallet;

let auctionRoot: AuctionRoot;
let auction: Auction;

let startBalanceTW1: number = 90000000000;
let startBalanceTW2: number = 90000000000;
let startBalanceTW3: number = 90000000000;

describe("Test Auction contract", async function () {

    it('Deploy account', async function () {
        account1 = await deployAccount(0, 20);
        account2 = await deployAccount(1, 10);
        account3 = await deployAccount(2, 10);
        account4 = await deployAccount(3, 20);
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
        tokenWallet3 = await tokenRoot.mint(startBalanceTW3, account4);
    });

    it('Deploy AuctionRootTip3', async function () {
        auctionRoot = await deployAuctionRoot(account1);
        logger.log("");
    });

    describe("Auction completed", async function () {
        it('Deploy Auction and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(tokenRoot, spentToken, Math.round(Date.now() / 1000), 30)).toString();

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

            await nft.changeManager(account2, auctionRoot.address, account2.address, callbacks);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;

            logger.log(auctionDeployedEvent.offerAddress);
            auction = await Auction.from_addr(auctionDeployedEvent.offerAddress, account2);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            await tokenWallet2.transfer(spentToken, auction.address, 0, true, '', locklift.utils.toNano(2));
            const spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const bidPlacedEvent = await auction.getEvent('BidPlaced') as any;
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account3.address.toString());

            await sleep(30000);
            await auction.finishAuction(account2);
            
            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());
            
            await auction.getEvent('AuctionComplete');

            const spentTokenWallet1Balance = await tokenWallet1.balance() as any;
            expect(spentTokenWallet1Balance.toString()).to.be.eq((startBalanceTW1 + spentToken).toString());

            startBalanceTW1 += spentToken;
            startBalanceTW2 -= spentToken;
            
            logger.log("");
        });
    });

    describe("Auction cancel from creater", async function () {
        it('Deploy Auction and cancel', async function () {
            const spentToken: number = 5000000000;            
            let payload: string;
            payload = (await auctionRoot.buildPayload(tokenRoot, spentToken, Math.round(Date.now() / 1000), 30)).toString();

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

            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks);
            
            let event = await auctionRoot.getEvent('AuctionDeployed') as any;
            logger.log(event.offerAddress);
            auction = await Auction.from_addr(event.offerAddress, account2);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            await tokenWallet2.transfer(spentToken, auction.address, 0,  true, '', locklift.utils.toNano(2));
            let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            await sleep(30000);
            await auction.finishAuction(account2);
            
            event = await nft.getEvent('ManagerChanged');
            expect(event.newManager.toString()).to.be.eq(account3.address.toString());
            await auction.getEvent('AuctionCancelled');
            spentTokenWallet2Balance = await tokenWallet2.balance();
            expect(spentTokenWallet2Balance.toString()).to.be.eq(startBalanceTW2.toString());
        });
    });

describe("Auction bidding variants", async function () {
    it('Deploy Auction and several users stake', async function () {
        const spentToken: number = 4000000000;
        let payload: string;
        payload = (await auctionRoot.buildPayload(tokenRoot, spentToken, Math.round(Date.now() / 1000), 30)).toString();

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

        await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks);
        const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;

        logger.log(auctionDeployedEvent.offerAddress);
        auction = await Auction.from_addr(auctionDeployedEvent.offerAddress, account3);
        logger.log(`AuctionTip3 address: ${auction.address.toString()}`);
        
        //First bid placed
        await tokenWallet1.transfer(spentToken, auction.address, 0, true, '', locklift.utils.toNano(2));
        let spentTokenWallet1Balance = await tokenWallet1.balance() as any;
        const bidPlacedEvent = await auction.getEvent('BidPlaced') as any;
        expect(bidPlacedEvent.buyer.toString()).to.be.eq(account2.address.toString());
        expect(spentTokenWallet1Balance.toString()).to.be.eq((startBalanceTW1 - spentToken).toString());

        //Second bid placed
        await tokenWallet3.transfer(spentToken + 10000000000, auction.address, 0, true, '', locklift.utils.toNano(2));
        let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
        const rebidPlacedEvent = await auction.getEvent('BidPlaced') as any;
        expect(rebidPlacedEvent.buyer.toString()).to.be.eq(account4.address.toString());
        expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken - 10000000000).toString());
        
        //Finish auction
        await sleep(30000);
        await auction.finishAuction(account2);

        const ownerChanged = await nft.getEvent('OwnerChanged') as any;
        expect(ownerChanged.newOwner.toString()).to.be.eq(account4.address.toString());

        const managerChanged = await nft.getEvent('ManagerChanged') as any;
        expect(managerChanged.newManager.toString()).to.be.eq(account4.address.toString());
        
        await auction.getEvent('AuctionComplete');

        spentTokenWallet1Balance = await tokenWallet1.balance() as any;
        let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
        expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 + spentToken + 10000000000).toString());
        expect(spentTokenWallet1Balance.toString()).to.be.eq((startBalanceTW1).toString());
        expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken - 10000000000 ).toString());
        
        startBalanceTW2 = startBalanceTW2 + spentToken + 10000000000;
        startBalanceTW3 = startBalanceTW3 - spentToken - 10000000000;

        logger.log("");


    });
});
  describe("Auction single rebid", async function () {
        it('Two stake with first user rebid', async function () {
        const spentToken: number = 1000000000;
        let payload: string;
        payload = (await auctionRoot.buildPayload(tokenRoot, spentToken, Math.round(Date.now() / 1000), 30)).toString();

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
        
        await nft.changeManager(account4, auctionRoot.address, account4.address, callbacks);
        const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;
        
        logger.log(auctionDeployedEvent.offerAddress);
        auction = await Auction.from_addr(auctionDeployedEvent.offerAddress, account3);
        logger.log(`AuctionTip3 address: ${auction.address.toString()}`);
        

        //First user bid
        await tokenWallet2.transfer(spentToken, auction.address, 0, true, '', locklift.utils.toNano(2));
        let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
        const bidPlacedEvent = await auction.getEvent('BidPlaced') as any;
        expect(bidPlacedEvent.buyer.toString()).to.be.eq(account3.address.toString());
        
        //Second user bid
        await tokenWallet1.transfer(spentToken + 1000000000, auction.address, 0, true, '', locklift.utils.toNano(2));
        let spentTokenWallet1Balance = await tokenWallet1.balance() as any;
        const rebidPlacedEvent = await auction.getEvent('BidPlaced') as any;
        expect(rebidPlacedEvent.buyer.toString()).to.be.eq(account2.address.toString());

        //First user rebid
        await tokenWallet2.transfer(spentToken + 2000000000 , auction.address, 0, true, '', locklift.utils.toNano(2));
        const newbidPlacedEvent = await auction.getEvent('BidPlaced') as any;
        expect(newbidPlacedEvent.buyer.toString()).to.be.eq(account3.address.toString());
        
        //Finish auction
        await sleep(30000);
        await auction.finishAuction(account2);

        const ownerChanged = await nft.getEvent('OwnerChanged') as any;
        expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

        const managerChanged = await nft.getEvent('ManagerChanged') as any;
        expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());
            
        await auction.getEvent('AuctionComplete');

        let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
        spentTokenWallet1Balance = await tokenWallet1.balance() as any;
        spentTokenWallet2Balance = await tokenWallet2.balance() as any;
        
        expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 + spentToken + 2000000000 ).toString());
        expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken - 2000000000).toString());
        expect(spentTokenWallet1Balance.toString()).to.be.eq((startBalanceTW1).toString());
   
        logger.log("");
        });
});
});

