import {
    CallbackType,
    deployAccount,
    deployAuctionRoot,
    deployCollectionAndMintNft,
    deployCollectionAndMintNftWithRoyalty,
    deployTokenRoot,
    deployWnativeRoot, now,
    tryIncreaseTime
} from "./utils";
import {Account} from "everscale-standalone-client/nodejs";
import {Auction, AuctionRoot} from "./wrappers/auction";
import {NftC} from "./wrappers/nft";
import {Token} from "./wrappers/token";
import {TokenWallet} from "./wrappers/token_wallet";
import {Address, Contract, lockliftChai, toNano} from "locklift";
import {BigNumber} from 'bignumber.js';
import chai from "chai";
import {FactorySource} from "../build/factorySource";

BigNumber.config({EXPONENTIAL_AT: 257});

const logger = require('mocha-logger');
const {expect} = require('chai');

chai.use(lockliftChai);

let account1: Account;
let account2: Account;
let account3: Account;
let account4: Account;
let account5: Account;

let nft: NftC;

let tokenRoot: Token;

let tokenWallet1: TokenWallet;
let tokenWallet2: TokenWallet;
let tokenWallet3: TokenWallet;
let tokenWallet4: TokenWallet;

let auctionRoot: AuctionRoot;
let auctionRootTWAddress: Address;
let auctionRootTW: TokenWallet;
let startBalanceTWAuctionRoot: BigNumber;

let auction: Auction;

let startBalanceTW1: number = 90000000000;
let startBalanceTW2: number = 90000000000;
let startBalanceTW3: number = 90000000000;
let startBalanceTW4: number = 90000000000;

type Royalty = {
    numerator: string;
    denominator: string;
    receiver: Address;
}


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
let burnFee: MarketBurnFee;
let setRoyalty: Royalty;
let bidDelta: BigNumber;
let bidDeltaDecimals: BigNumber;

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
        auctionRoot.address,
        {
            value: calcValue(gasValue.start, gasValue.gasK).toString(),
            payload: payload,
        },
    ];

    const callbacks: CallbackType[] = [];
    callbacks.push(callback);
    return (callbacks);
}

function calcValue(gas: GasValue, gasK: string) {
    const gasPrice = new BigNumber(1).shiftedBy(9).div(gasK);
    return new BigNumber(gas.dynamicGas).times(gasPrice).plus(gas.fixedValue).toNumber();
}

describe("Test Auction contract", async function () {
    it('Deploy account', async function () {
        account1 = await deployAccount(0, 20);
        account2 = await deployAccount(1, 30);
        account3 = await deployAccount(2, 60);
        account4 = await deployAccount(3, 20);
        account5 = await deployAccount(4, 10);
    });
    it('Deploy NFT-Collection and Mint Nft', async function () {
        let accForNft: Account[] = [];
        accForNft.push(account2);
        const [collection, nftS] = await deployCollectionAndMintNft(account2, 1, "nft_to_address.json", accForNft);
        nft = nftS[0];
        locklift.tracing.setAllowedCodesForAddress(collection.address, {compute: [60]});
        locklift.tracing.setAllowedCodesForAddress(nft.address, {compute: [60]});
    });
    it('Deploy discount Collection and Mint Nft for Account3', async function () {
        let accForNft: Account[] = [];
        accForNft.push(account3);

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
        tokenWallet3 = await tokenRoot.mint(startBalanceTW3, account3);
        tokenWallet4 = await tokenRoot.mint(startBalanceTW4, account4);
    });
    it('Deploy AuctionRootTip3 with fee denominator zero', async function () {
        let fee = {
            numerator: '10',
            denominator: '0'
        } as MarketFee;
        const auctionRootExitCode = await deployAuctionRoot(
            account2, fee, wnativeRoot.address
        ).catch(e => e.transaction.transaction.exitCode);
        expect(auctionRootExitCode.toString()).to.be.eq('110');
    });
    it('Deploy AuctionRootTip3', async function () {
        let fee = {
            numerator: '10',
            denominator: '100'
        } as MarketFee;
        auctionRoot = await deployAuctionRoot(account2, fee, wnativeRoot.address);
        const eventMFChanged = await auctionRoot.getEvent('MarketFeeDefaultChanged') as any;
        expect(eventMFChanged.fee).to.eql((await auctionRoot.contract.methods.marketFee().call()).value0);
    });
    it('Get address token wallet for AuctionRoot', async function () {
        auctionRootTWAddress = await tokenRoot.walletAddr(auctionRoot.address);
        auctionRootTW = await TokenWallet.from_addr(auctionRootTWAddress, null);
        startBalanceTWAuctionRoot = new BigNumber(await auctionRootTW.balanceSafe());
        // const tokenWallet = await locklift.factory.getDeployedContract('TokenWalletUpgradeable', tokenWalletAddress);
    });
    it('Get market fee', async function () {
        fee = (await auctionRoot.contract.methods.marketFee().call()).value0;
    });
    it('Get bid delta', async function () {
        bidDelta = new BigNumber((await auctionRoot.contract.methods.auctionBidDelta().call()).auctionBidDelta);
        bidDeltaDecimals = new BigNumber((await auctionRoot.contract.methods.auctionBidDeltaDecimals().call()).auctionBidDeltaDecimals);
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
        await auctionRoot.contract.methods.addCollectionsSpecialRules({
            _collection: discountCollection.address,
            _collectionFeeInfo: discountInfo
        }).send(
            {
                from: account2.address,
                amount: toNano(1)
            });
        const a = await auctionRoot.contract.methods.collectionsSpecialRules({}).call()
        // console.log(a.collectionsSpecialRules);
    });
    it('Get fas value', async function () {
        gasValue = (await auctionRoot.contract.methods.getGasValue().call()).value0;
        console.log(gasValue);
        changeManagerValue = (calcValue(gasValue.start, gasValue.gasK) + 250000000).toString();
        transferValue = (calcValue(gasValue.bid, gasValue.gasK) + 250000000).toString();
        cancelValue = (calcValue(gasValue.cancel, gasValue.gasK) + 200000000).toString();
        console.log('transferValue', transferValue);
        console.log('changeManagerValue', changeManagerValue);
        console.log('cancelValue', cancelValue);
    });
    describe("Auction completed", async function () {
        it('Deploy Auction and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(now() / 1000), 5)).toString();
            let callbacks = await Callback(payload);
            await nft.changeManager(account2, auctionRoot.address, account2.address, callbacks, changeManagerValue);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed');

            auction = await Auction.from_addr(auctionDeployedEvent!.offer, account2) as any;
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            await tokenWallet3.transfer(spentToken, auction.address, 0, true, '', transferValue);

            const spentTokenWallet3Balance = await tokenWallet3.balance();
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            const bidPlacedEvent = await auction.getEvent('BidPlaced') as any;
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account3.address.toString());

            await tryIncreaseTime(6);
            await auction.finishAuction(account2, 0, cancelValue);

            const eventAuctionComplete = await auction.getEvent('AuctionComplete');
            expect(eventAuctionComplete).to.be.not.null;

            let owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq(account3.address.toString());

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            let status = (await auction.getInfo()).status;
            expect(status.toString()).to.be.eq('2');

            let currentFee = new BigNumber(spentToken).div(fee.denominator).times(fee.numerator);
            const spentTokenWallet2Balance = await tokenWallet2.balance();
            const expectedAccountBalance = new BigNumber(startBalanceTW2).plus(spentToken).minus(currentFee);
            const auctionRootTokenWalletBalance = await auctionRootTW.balance();
            const expectedTWAuctionBalance = startBalanceTWAuctionRoot.plus(currentFee);

            expect(spentTokenWallet2Balance.toString()).to.be.eq(expectedAccountBalance.toString());
            expect(auctionRootTokenWalletBalance.toString()).to.be.eq(expectedTWAuctionBalance.toString());

            startBalanceTW2 = new BigNumber(spentToken).minus(currentFee).plus(startBalanceTW2).toNumber();
            startBalanceTW3 -= spentToken;
            startBalanceTWAuctionRoot = startBalanceTWAuctionRoot.plus(currentFee);
        });
    });
    describe("Auction cancel from creater", async function () {
        it('Deploy Auction and cancel', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(now() / 1000), 3, discountCollection.address, nftId)).toString();
            let callbacks = await Callback(payload);
            (await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks, changeManagerValue))
                .traceTree?.beautyPrint();

            let eventAuctionDeployed = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(eventAuctionDeployed.offer, account2);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            let discountFee = (await auction.contract.methods.marketFee().call()).value0;
            expect(discountInfo.numerator).to.be.eq(discountFee.numerator);
            expect(discountInfo.denominator).to.be.eq(discountFee.denominator);

            await tryIncreaseTime(6);
            (await auction.finishAuction(account3, 0, cancelValue))
                .traceTree?.beautyPrint();

            let eventManagerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(eventManagerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            let eventAuctionCancelled = await auction.getEvent('AuctionCancelled');
            // expect(eventAuctionCancelled).to.eql({});

            let owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq(account3.address.toString());

            let status = (await auction.getInfo()).status;
            expect(status.toString()).to.be.eq('3');
        });
    });
    describe("Auction bidding variants", async function () {
        it('Deploy Auction and several users stake', async function () {
            const spentToken: number = 4000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(now() / 1000), 10, discountCollection.address, nftId)).toString();
            let callbacks = await Callback(payload);
            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks, changeManagerValue);
            console.log('balanse3:', await tokenWallet3.balance());

            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(auctionDeployedEvent.offer, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            let discountFee = (await auction.contract.methods.marketFee().call()).value0;
            expect(discountInfo.numerator).to.be.eq(discountFee.numerator);
            expect(discountInfo.denominator).to.be.eq(discountFee.denominator);

            //First bid placed
            await tokenWallet2.transfer(spentToken, auction.address, 0, true, '', transferValue);
            let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const firstBid = await auction.contract.methods.currentBid({}).call();
            expect(firstBid.currentBid.addr.toString()).to.be.eq(account2.address.toString());
            expect(firstBid.currentBid.value.toString()).to.be.eq(spentToken.toString());

            let nextBid = new BigNumber((await auction.contract.methods.nextBidValue({}).call()).nextBidValue);
            let expectedNextBid = new BigNumber(spentToken).times(bidDelta).div(bidDeltaDecimals).plus(spentToken);
            expect(nextBid.toString()).to.be.eq(expectedNextBid.toString());

            //Second bid placed
            await tokenWallet4.transfer(nextBid.toNumber(), auction.address, 0, true, '', transferValue);

            let spentTokenWallet4Balance = await tokenWallet4.balance() as any;
            expect(spentTokenWallet4Balance.toString()).to.be.eq(new BigNumber(startBalanceTW4).minus(nextBid).toString());

            const secondBid = await auction.contract.methods.currentBid({}).call();
            expect(secondBid.currentBid.addr.toString()).to.be.eq(account4.address.toString());
            expect(secondBid.currentBid.value.toString()).to.be.eq(nextBid.toString());

            //Finish auction
            await tryIncreaseTime(15);
            await auction.finishAuction(account2, 0, cancelValue);

            const eventAuctionComplete = await auction.getEvent('AuctionComplete');
            expect(eventAuctionComplete).not.to.be.null;

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account4.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account4.address.toString());

            let owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq(account4.address.toString());

            let status = (await auction.getInfo()).status;
            expect(status.toString()).to.be.eq('2');

            let currentFee = nextBid.div(discountInfo.denominator).times(discountInfo.numerator);
            console.log('currentFee', currentFee.toNumber());
            console.log('startBalanceTW3', startBalanceTW3);
            const expectedBalance3 = new BigNumber(startBalanceTW3).plus(nextBid).minus(currentFee);
            console.log('expectedBalance3', expectedBalance3.toNumber());
            console.log('nextBid', nextBid.toNumber());
            spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2).toString());

            let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            console.log('spentTokenWallet3Balance', spentTokenWallet3Balance);
            expect(spentTokenWallet3Balance.toString()).to.be.eq(expectedBalance3.toString());

            spentTokenWallet4Balance = await tokenWallet4.balance() as any;
            expect(spentTokenWallet4Balance.toString()).to.be.eq((new BigNumber(startBalanceTW4).minus(nextBid)).toString());

            const auctionRootTokenWalletBalance = await auctionRootTW.balance();
            expect(auctionRootTokenWalletBalance.toString()).to.be.eq(startBalanceTWAuctionRoot.plus(currentFee).toString());

            startBalanceTW3 = new BigNumber(startBalanceTW3).plus(nextBid).minus(currentFee).toNumber();
            startBalanceTW4 = new BigNumber(startBalanceTW4).minus(nextBid).toNumber();
            startBalanceTWAuctionRoot = startBalanceTWAuctionRoot.plus(currentFee);
        });
        it('Two stake with first user rebid', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(now() / 1000), 20)).toString();

            let callbacks = await Callback(payload);
            await nft.changeManager(account4, auctionRoot.address, account4.address, callbacks, changeManagerValue);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;

            auction = await Auction.from_addr(auctionDeployedEvent.offer, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            //First user bid
            await tokenWallet3.transfer(spentToken, auction.address, 0, true, '', transferValue);
            const firstBid = await auction.contract.methods.currentBid({}).call();
            expect(firstBid.currentBid.addr.toString()).to.be.eq(account3.address.toString());
            expect(firstBid.currentBid.value.toString()).to.be.eq(spentToken.toString());

            //Second user bid
            await tokenWallet2.transfer(spentToken + 1000000000, auction.address, 0, true, '', transferValue);
            const secondBid = await auction.contract.methods.currentBid({}).call();
            expect(secondBid.currentBid.addr.toString()).to.be.eq(account2.address.toString());
            expect(secondBid.currentBid.value.toString()).to.be.eq((spentToken + 1000000000).toString());

            //First user rebid
            await tokenWallet3.transfer(spentToken + 2000000000, auction.address, 0, true, '', transferValue);
            const rebidFirstBid = await auction.contract.methods.currentBid({}).call();
            expect(rebidFirstBid.currentBid.addr.toString()).to.be.eq(account3.address.toString());
            expect(rebidFirstBid.currentBid.value.toString()).to.be.eq((spentToken + 2000000000).toString());

            //Finish auction
            await tryIncreaseTime(20);
            await auction.finishAuction(account3, 0, cancelValue);

            const eventAuctionComplete = await auction.getEvent('AuctionComplete');
            expect(eventAuctionComplete).not.to.be.null;

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            let spentTokenWallet4Balance = await tokenWallet4.balance() as any;
            let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            let status = (await auction.getInfo()).status;
            let owner = (await nft.getInfo()).owner;
            let currentFee = new BigNumber(spentToken + 2000000000).div(fee.denominator).times(fee.numerator);
            const expectedBalance4 = new BigNumber(startBalanceTW4).plus(spentToken).plus(2000000000).minus(currentFee);

            expect(status.toString()).to.be.eq('2');
            expect(owner.toString()).to.be.eq(account3.address.toString());
            expect(spentTokenWallet4Balance.toString()).to.be.eq(expectedBalance4.toString());
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken - 2000000000).toString());
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2).toString());

            const auctionRootTokenWalletBalance = await auctionRootTW.balance();
            expect(auctionRootTokenWalletBalance.toString()).to.be.eq(startBalanceTWAuctionRoot.plus(currentFee).toString());

            startBalanceTW4 = startBalanceTW4 + spentToken + 2000000000 - currentFee.toNumber();
            startBalanceTW3 = startBalanceTW3 - spentToken - 2000000000;
            startBalanceTWAuctionRoot = startBalanceTWAuctionRoot.plus(currentFee);
        });
    });
    describe("Delete discount Collection", async function () {
        it('Delete discount collection', async function () {
            await auctionRoot.contract.methods.removeCollectionsSpecialRules({
                _collection: discountCollection.address
            }).send(
                {
                    from: account2.address,
                    amount: toNano(1)
                });
        });
    });
    describe("Auction negative testing", async function () {
        it('Trying to stake less then auction bid', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(now() / 1000), 3, discountCollection.address, nftId)).toString();

            let callbacks = await Callback(payload);
            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks, changeManagerValue);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;

            auction = await Auction.from_addr(auctionDeployedEvent.offer, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            let discountFee = (await auction.contract.methods.marketFee().call()).value0;
            expect(fee.numerator).to.be.eq(discountFee.numerator);
            expect(fee.denominator).to.be.eq(discountFee.denominator);

            await tokenWallet4.transfer(10000, auction.address, 0, true, '', transferValue);

            const bidPlacedEvent = await auction.getEvent('BidDeclined') as any;
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account4.address.toString());
            expect(bidPlacedEvent.value).to.be.eq('10000');

            let status = (await auction.getInfo()).status;
            expect(status.toString()).to.be.eq('1');

            await tryIncreaseTime(6);
            await auction.finishAuction(account3, 0, cancelValue);
            let eventAuctionCancelled = await auction.getEvent('AuctionCancelled');
            // expect(eventAuctionCancelled).to.eql({});

            let spentTokenWallet4Balance = await tokenWallet4.balance() as any;
            expect(spentTokenWallet4Balance.toString()).to.be.eq((startBalanceTW4).toString());

            let owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq(account3.address.toString());

            const auctionRootTokenWalletBalance = await auctionRootTW.balance();
            expect(auctionRootTokenWalletBalance.toString()).to.be.eq(startBalanceTWAuctionRoot.toString());

            let statusCancell = (await auction.getInfo()).status;
            expect(statusCancell.toString()).to.be.eq('3');
        });
        it('Trying to stake after auction closed', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(now() / 1000), 3, discountCollection.address, nftId)).toString();
            let callbacks = await Callback(payload);

            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks, changeManagerValue);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(auctionDeployedEvent.offer, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            await tryIncreaseTime(6);
            await auction.finishAuction(account3, 0, cancelValue);
            let eventAuctionCancelled = await auction.getEvent('AuctionCancelled');
            // expect(eventAuctionCancelled).to.eql({});

            await tokenWallet1.transfer(spentToken, auction.address, 0, true, '', transferValue);

            let owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq(account3.address.toString());

            let manager = (await nft.getInfo()).manager;
            expect(manager.toString()).to.be.eq(account3.address.toString());

            let spentTokenWallet1Balance = await tokenWallet1.balance() as any;
            expect(spentTokenWallet1Balance.toString()).to.be.eq((startBalanceTW1).toString());

            const bidPlacedEvent = await auction.getEvent('BidDeclined') as any;
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account1.address.toString());

            let status = (await auction.getInfo()).status;
            expect(status.toString()).to.be.eq('3');
        });
        it('Trying to stake after auction finished, but not closed', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(now() / 1000), 3, discountCollection.address, nftId)).toString();

            let callbacks = await Callback(payload);
            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks, changeManagerValue);

            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(auctionDeployedEvent.offer, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            await tryIncreaseTime(6);
            await tokenWallet1.transfer(spentToken, auction.address, 0, true, '', transferValue);
            const bidPlacedEvent = await auction.getEvent('BidDeclined') as any;
            expect(bidPlacedEvent).to.be.not.null;

            await auction.finishAuction(account3, 0, cancelValue);
            const eventAuctionCancelled = await auction.getEvent('AuctionCancelled');
            // expect(eventAuctionCancelled).to.eql({});

            let spentTokenWallet1Balance = await tokenWallet1.balance() as any;
            let status = (await auction.getInfo()).status;
            let owner = (await nft.getInfo()).owner;
            let manager = (await nft.getInfo()).manager;
            expect(status.toString()).to.be.eq('3');
            expect(owner.toString()).to.be.eq(account3.address.toString());
            expect(manager.toString()).to.be.eq(account3.address.toString());
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account1.address.toString());
            expect(spentTokenWallet1Balance.toString()).to.be.eq((startBalanceTW1).toString());
        });
        it('Trying to deploy zero duration auction', async function () {
            const spentToken: number = 1500000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(now() / 1000), 0, discountCollection.address, nftId)).toString();

            let callbacks = await Callback(payload);
            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks, changeManagerValue);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeclined') as any;
            expect(auctionDeployedEvent).to.be.not.null;

            let manager = (await nft.getInfo()).manager;
            expect(manager.toString()).to.be.eq(account3.address.toString());

            let owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq(account3.address.toString());
        });
        it('Trying to finish auction afters its closed', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(now() / 1000), 5, discountCollection.address, nftId)).toString();

            let callbacks = await Callback(payload);

            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks, changeManagerValue);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(auctionDeployedEvent.offer, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            locklift.tracing.setAllowedCodesForAddress(auction.address, {compute: [253]});
            await tokenWallet2.transfer(spentToken, auction.address, 0, true, '', transferValue);
            let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            const bidPlacedEvent = await auction.getEvent('BidPlaced') as any;
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account2.address.toString());
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            await tryIncreaseTime(10);
            await auction.finishAuction(account2, 0, cancelValue);
            const eventAuctionComplete = await auction.getEvent('AuctionComplete');
            expect(eventAuctionComplete).to.be.not.null;

            let status = (await auction.getInfo()).status;
            let owner = (await nft.getInfo()).owner;
            expect(status.toString()).to.be.eq('2');
            expect(owner.toString()).to.be.eq(account2.address.toString());

            let currentFee = new BigNumber(spentToken).div(fee.denominator).times(fee.numerator);
            const expectedBalance3 = new BigNumber(startBalanceTW3).plus(spentToken).minus(currentFee);

            const auctionRootTokenWalletBalance = await auctionRootTW.balance();
            expect(auctionRootTokenWalletBalance.toString()).to.be.eq(startBalanceTWAuctionRoot.plus(currentFee).toString());

            let spentTokenWallet2Balance2 = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance2.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance.toString()).to.be.eq(expectedBalance3.toString());

            const {traceTree} = await auction.finishAuction(account2, 0, cancelValue);
            expect(traceTree).to.have.error(253);

            const eventAuctionComplete2 = await auction.getEvent('AuctionComplete');
            expect(eventAuctionComplete2).to.be.not.null;

            let status2 = (await auction.getInfo()).status;
            let owner2 = (await nft.getInfo()).owner;
            expect(status2.toString()).to.be.eq('2');
            expect(owner2.toString()).to.be.eq(account2.address.toString());

            const auctionRootTokenWalletBalance2 = await auctionRootTW.balance();
            expect(auctionRootTokenWalletBalance2.toString()).to.be.eq(startBalanceTWAuctionRoot.plus(currentFee).toString());

            let spentTokenWallet3Balance2 = await tokenWallet3.balance() as any;
            expect(spentTokenWallet3Balance2.toString()).to.be.eq(expectedBalance3.toString());

            startBalanceTW3 = startBalanceTW3 + spentToken - currentFee.toNumber();
            startBalanceTW2 = startBalanceTW2 - spentToken;
            startBalanceTWAuctionRoot = startBalanceTWAuctionRoot.plus(currentFee);
        });
        it('Trying to stake before auction starts', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(now() / 1000) + 5, 7)).toString();

            let callbacks = await Callback(payload);

            await nft.changeManager(account2, auctionRoot.address, account2.address, callbacks, changeManagerValue);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(auctionDeployedEvent.offer, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            let status = (await auction.getInfo()).status;
            expect(status.toString()).to.be.eq('1');

            await tokenWallet4.transfer(spentToken, auction.address, 0, true, '', transferValue);
            const bidPlacedEvent = await auction.getEvent('BidDeclined') as any;
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account4.address.toString());

            let spentTokenWallet4Balance = await tokenWallet4.balance() as any;
            expect(spentTokenWallet4Balance.toString()).to.be.eq((startBalanceTW4).toString());

            let status2 = (await auction.getInfo()).status;
            expect(status2.toString()).to.be.eq('1');


            await tryIncreaseTime(20);
            await auction.finishAuction(account2, 0, cancelValue);
            const eventAuctionCancelled = await auction.getEvent('AuctionCancelled');
            // expect(eventAuctionCancelled).to.eql({});

            let manager = (await nft.getInfo()).manager;
            let spentTokenWallet4Balance2 = await tokenWallet4.balance() as any;
            expect(manager.toString()).to.be.eq(account2.address.toString());
            expect(spentTokenWallet4Balance2.toString()).to.be.eq((startBalanceTW4).toString());
        });
        it('Trying finish auction before its start', async function () {
            const spentToken: number = 1000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(((now() / 1000)) + 5), 7)).toString();

            let callbacks = await Callback(payload);

            await nft.changeManager(account2, auctionRoot.address, account2.address, callbacks, changeManagerValue);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(auctionDeployedEvent.offer, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            let status = (await auction.getInfo()).status;
            expect(status.toString()).to.be.eq('1');

            locklift.tracing.setAllowedCodesForAddress(auction.address, {compute: [250]});
            const {traceTree} = await auction.finishAuction(account2, 0, cancelValue);
            expect(traceTree).to.have.error(250);

            let owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq(account2.address.toString());
            expect(status.toString()).to.be.eq('1');

            await tryIncreaseTime(15);
            await auction.finishAuction(account2, 0, cancelValue);
            await auction.getEvent('AuctionCancelled');
        });
    });
    describe("Change market fee", async function () {
        it('Change market fee', async function () {
            let oldFee = (await auctionRoot.contract.methods.marketFee().call()).value0;
            expect(oldFee).to.eql(fee);

            let setFee = {
                numerator: '20',
                denominator: '100'
            } as MarketFee;

            await auctionRoot.contract.methods.setMarketFee({_fee: setFee}).send({
                from: account2.address,
                amount: toNano(2)
            });

            let newFee = (await auctionRoot.contract.methods.marketFee().call()).value0;
            expect(setFee.numerator).to.eql(newFee.numerator);
            expect(setFee.denominator).to.eql(newFee.denominator);
            fee = newFee;
        });
        it('Change market fee with zero denominator', async function () {
            let oldFee = (await auctionRoot.contract.methods.marketFee().call()).value0;
            expect(oldFee).to.eql(fee);

            let setFee = {
                numerator: '20',
                denominator: '0'
            } as MarketFee;

            await auctionRoot.contract.methods.setMarketFee({_fee: setFee}).send({
                from: account2.address,
                amount: toNano(2)
            });
            let newFee = (await auctionRoot.contract.methods.marketFee().call()).value0;
            expect(newFee).to.eql(oldFee);
        });
    });
    describe("Withdraw", async function () {
        it('Trying withdraw part of token', async function () {
            const withdrawAmount = 1000000000;
            const auctionRootTokenWalletBalance = await auctionRootTW.balance();
            expect(auctionRootTokenWalletBalance.toString()).to.be.eq(startBalanceTWAuctionRoot.toString());
            let spentTokenWallet1Balance = await tokenWallet1.balance();
            expect(spentTokenWallet1Balance.toString()).to.be.eq(startBalanceTW1.toString());

            await auctionRoot.withdraw(
                auctionRootTW.address,
                BigNumber(withdrawAmount).toNumber(),
                account1.address,
                account2.address,
                account2.address
            );

            const auctionRootTokenWalletBalance1 = await auctionRootTW.balance();
            expect(auctionRootTokenWalletBalance1.toString()).to.be.eq((startBalanceTWAuctionRoot.minus(new BigNumber(withdrawAmount))).toString());
            let spentTokenWallet1Balance1 = await tokenWallet1.balance();
            expect(spentTokenWallet1Balance1.toString()).to.be.eq((startBalanceTW1 + withdrawAmount).toString());

            startBalanceTWAuctionRoot = startBalanceTWAuctionRoot.minus(new BigNumber(withdrawAmount));
            startBalanceTW1 = startBalanceTW1 + withdrawAmount;
        });
        it('Trying withdraw more then have', async function () {
            const withdrawAmount = 330000000;
            const auctionRootTokenWalletBalance = await auctionRootTW.balance();
            expect(auctionRootTokenWalletBalance.toString()).to.be.eq(startBalanceTWAuctionRoot.toString());
            let spentTokenWallet1Balance = await tokenWallet1.balance();
            expect(spentTokenWallet1Balance.toString()).to.be.eq(startBalanceTW1.toString());

            await auctionRoot.withdraw(
                auctionRootTW.address,
                BigNumber(withdrawAmount).toNumber(),
                account1.address,
                account2.address,
                account2.address
            );

            const auctionRootTokenWalletBalance1 = await auctionRootTW.balance();
            expect(auctionRootTokenWalletBalance1.toString()).to.be.eq((startBalanceTWAuctionRoot).toString());
            let spentTokenWallet1Balance1 = await tokenWallet1.balance();
            expect(spentTokenWallet1Balance1.toString()).to.be.eq((startBalanceTW1).toString());
        });
        it('Trying withdraw all rest of token', async function () {
            const auctionRootTokenWalletBalance = await auctionRootTW.balance();
            expect(auctionRootTokenWalletBalance.toString()).to.be.eq(startBalanceTWAuctionRoot.toString());
            let spentTokenWallet1Balance = await tokenWallet1.balance();
            expect(spentTokenWallet1Balance.toString()).to.be.eq(startBalanceTW1.toString());

            const withdrawAmount = auctionRootTokenWalletBalance;

            await auctionRoot.withdraw(
                auctionRootTW.address,
                BigNumber(withdrawAmount).toNumber(),
                account1.address,
                account2.address,
                account2.address
            );

            const auctionRootTokenWalletBalance1 = await auctionRootTW.balance();
            expect(auctionRootTokenWalletBalance1.toString()).to.be.eq((0).toString());
            let spentTokenWallet1Balance1 = await tokenWallet1.balance();
            expect(spentTokenWallet1Balance1.toString()).to.be.eq((new BigNumber(startBalanceTW1).plus(withdrawAmount)).toString());

            startBalanceTWAuctionRoot = startBalanceTWAuctionRoot.minus(new BigNumber(withdrawAmount));
            startBalanceTW1 = (new BigNumber(startBalanceTW1).plus(withdrawAmount)).toNumber();
        });
    });
    describe("Integration with Venom Burn", async function () {
        it('Change market burn fee', async function () {

            burnFee = {
                numerator: '20',
                denominator: '100',
                project: auctionRoot.address,
                burnRecipient: account5.address,
            } as MarketBurnFee

            await auctionRoot.contract.methods.setMarketBurnFee({_fee: burnFee}).send({
                from: account2.address,
                amount: toNano(2)
            });

            let newFee = (await auctionRoot.contract.methods.marketBurnFee().call()).value0;
            expect(burnFee.numerator).to.eql(newFee?.numerator);
            expect(burnFee.denominator).to.eql(newFee?.denominator);
        });
        it('Change market burn fee with zero denominator', async function () {
            let oldFee = (await auctionRoot.contract.methods.marketBurnFee().call()).value0;
            expect(JSON.stringify(oldFee)).to.eql(JSON.stringify(burnFee));

            let setFee = {
                numerator: '20',
                denominator: '0',
                project: auctionRoot.address,
                burnRecipient: account5.address,
            } as MarketBurnFee

            await auctionRoot.contract.methods.setMarketBurnFee({_fee: setFee}).send({
                from: account2.address,
                amount: toNano(2)
            });
            let newFee = (await auctionRoot.contract.methods.marketBurnFee().call()).value0;
            expect(JSON.stringify(newFee)).to.eql(JSON.stringify(oldFee));
        });
        it('Deploy Auction and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(now() / 1000), 5)).toString();
            let callbacks = await Callback(payload);
            console.log((await nft.getInfo()).manager);
            await nft.changeManager(account2, auctionRoot.address, account2.address, callbacks, changeManagerValue);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed');

            auction = await Auction.from_addr(auctionDeployedEvent!.offer, account2) as any;
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            await tokenWallet3.transfer(spentToken, auction.address, 0, true, '', transferValue);

            const spentTokenWallet3Balance = await tokenWallet3.balance();
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            const bidPlacedEvent = await auction.getEvent('BidPlaced') as any;
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account3.address.toString());

            await tryIncreaseTime(6);
            await auction.finishAuction(account2, 0, cancelValue);

            const eventAuctionComplete = await auction.getEvent('AuctionComplete');
            expect(eventAuctionComplete).to.be.not.null;

            let owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq(account3.address.toString());

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            let status = (await auction.getInfo()).status;
            expect(status.toString()).to.be.eq('2');

            let currentFee = new BigNumber(spentToken).div(fee.denominator).times(fee.numerator);
            let currentBurnFee = new BigNumber(currentFee).div(burnFee.denominator).times(burnFee.numerator);

            const spentTokenWallet2Balance = await tokenWallet2.balance();
            const expectedAccountBalance = new BigNumber(startBalanceTW2).plus(spentToken).minus(currentFee);
            const auctionRootTokenWalletBalance = await auctionRootTW.balance();
            const expectedTWAuctionBalance = startBalanceTWAuctionRoot.plus(currentFee);

            expect(spentTokenWallet2Balance.toString()).to.be.eq(expectedAccountBalance.toString());
            expect(auctionRootTokenWalletBalance.toString()).to.be.eq(expectedTWAuctionBalance.minus(currentBurnFee).toString());

            startBalanceTW2 = new BigNumber(spentToken).minus(currentFee).plus(startBalanceTW2).toNumber();
            startBalanceTW3 -= spentToken;
            startBalanceTWAuctionRoot = startBalanceTWAuctionRoot.plus(currentFee).minus(currentBurnFee);
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
        it('Deploy Auction and success', async function () {
            const spentToken: number = 5000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(now() / 1000), 5)).toString();
            let callbacks = await Callback(payload);
            const spentTokenWallet4StartBalance = new BigNumber(await tokenWallet4.balance());


            await nft.changeManager(account2, auctionRoot.address, account2.address, callbacks, changeManagerValue);
            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed');

            auction = await Auction.from_addr(auctionDeployedEvent!.offer, account2) as any;
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            await tokenWallet3.transfer(spentToken, auction.address, 0, true, '', transferValue);

            const spentTokenWallet3Balance = await tokenWallet3.balance();
            expect(spentTokenWallet3Balance.toString()).to.be.eq((startBalanceTW3 - spentToken).toString());

            const bidPlacedEvent = await auction.getEvent('BidPlaced') as any;
            expect(bidPlacedEvent.buyer.toString()).to.be.eq(account3.address.toString());

            await tryIncreaseTime(6);
            await auction.finishAuction(account2, 0, cancelValue);

            const eventAuctionComplete = await auction.getEvent('AuctionComplete');
            expect(eventAuctionComplete).to.be.not.null;

            let owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq(account3.address.toString());

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account3.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account3.address.toString());

            const RoyaltySet = await auction.getEvent("RoyaltySet") as any;
            expect(RoyaltySet._royalty.numerator.toString()).to.be.eq((new BigNumber(setRoyalty.numerator).times(10000000)).toString())
            expect(RoyaltySet._royalty.denominator.toString()).to.be.eq((new BigNumber(setRoyalty.denominator).times(10000000)).toString())
            expect(RoyaltySet._royalty.receiver.toString()).to.be.eq(account4.address.toString())

            let status = (await auction.getInfo()).status;
            expect(status.toString()).to.be.eq('2');

            let currentFee = new BigNumber(spentToken).div(fee.denominator).times(fee.numerator);
            let currentBurnFee = new BigNumber(currentFee).div(burnFee.denominator).times(burnFee.numerator);
            let currentRoyaltyFee = new BigNumber(spentToken).div(setRoyalty.denominator).times(setRoyalty.numerator);

            const RoyaltyWithdrawn = await auction.getEvent("RoyaltyWithdrawn") as any;
            expect(RoyaltyWithdrawn.recipient.toString()).to.be.eq(account4.address.toString())
            expect(RoyaltyWithdrawn.amount.toString()).to.be.eq(currentRoyaltyFee.toString())
            expect(RoyaltyWithdrawn.paymentToken.toString()).to.be.eq(tokenRoot.address.toString())

            const spentTokenWallet4EndBalance = new BigNumber(await tokenWallet4.balance());
            const spentTokenWallet2Balance = await tokenWallet2.balance();
            const expectedAccountBalance = new BigNumber(startBalanceTW2).plus(spentToken).minus(currentFee).minus(currentRoyaltyFee);
            const auctionRootTokenWalletBalance = await auctionRootTW.balance();
            const expectedTWAuctionBalance = startBalanceTWAuctionRoot.plus(currentFee);
            expect((spentTokenWallet4EndBalance.minus(spentTokenWallet4StartBalance)).toString()).to.be.eq(currentRoyaltyFee.toString())
            expect(spentTokenWallet2Balance.toString()).to.be.eq(expectedAccountBalance.toString());
            expect(auctionRootTokenWalletBalance.toString()).to.be.eq(expectedTWAuctionBalance.minus(currentBurnFee).toString());
            startBalanceTW4 += currentRoyaltyFee.toNumber()
            startBalanceTW2 = new BigNumber(spentToken).minus(currentFee).plus(startBalanceTW2).minus(currentRoyaltyFee).toNumber();
            startBalanceTW3 -= spentToken;
            startBalanceTWAuctionRoot = startBalanceTWAuctionRoot.plus(currentFee).minus(currentBurnFee);
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
        it('Deploy Auction and several users stake', async function () {
            const spentToken: number = 4000000000;
            let payload: string;
            payload = (await auctionRoot.buildPayload(0, tokenRoot, spentToken, Math.round(now() / 1000), 10, discountCollection.address, nftId)).toString();
            let callbacks = await Callback(payload);
            gasValue = (await auctionRoot.contract.methods.getGasValue().call()).value0;
            console.log(gasValue);
            await nft.changeManager(account3, auctionRoot.address, account3.address, callbacks, changeManagerValue);
            console.log('balanse3:', await tokenWallet3.balance());

            const auctionDeployedEvent = await auctionRoot.getEvent('AuctionDeployed') as any;
            auction = await Auction.from_addr(auctionDeployedEvent.offer, account3);
            logger.log(`AuctionTip3 address: ${auction.address.toString()}`);

            // let discountFee = (await auction.contract.methods.marketFee().call()).value0;
            // expect(discountInfo.numerator).to.be.eq(discountFee.numerator);
            // expect(discountInfo.denominator).to.be.eq(discountFee.denominator);

            const RoyaltySet = await auction.getEvent("RoyaltySet") as any;
            expect(RoyaltySet._royalty.numerator.toString()).to.be.eq((new BigNumber(setRoyalty.numerator).times(10000000)).toString())
            expect(RoyaltySet._royalty.denominator.toString()).to.be.eq((new BigNumber(setRoyalty.denominator).times(10000000)).toString())
            expect(RoyaltySet._royalty.receiver.toString()).to.be.eq(account4.address.toString())


            //First bid placed
            await tokenWallet2.transfer(spentToken, auction.address, 0, true, '', transferValue);
            let spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2 - spentToken).toString());

            const firstBid = await auction.contract.methods.currentBid({}).call();
            expect(firstBid.currentBid.addr.toString()).to.be.eq(account2.address.toString());
            expect(firstBid.currentBid.value.toString()).to.be.eq(spentToken.toString());

            let nextBid = new BigNumber((await auction.contract.methods.nextBidValue({}).call()).nextBidValue);
            let expectedNextBid = new BigNumber(spentToken).times(bidDelta).div(bidDeltaDecimals).plus(spentToken);
            expect(nextBid.toString()).to.be.eq(expectedNextBid.toString());

            //Second bid placed
            await tokenWallet4.transfer(nextBid.toNumber(), auction.address, 0, true, '', transferValue);


            let spentTokenWallet4Balance = await tokenWallet4.balance() as any;
            console.log(`spentTokenWallet4Balance -  ${spentTokenWallet4Balance.toString()}\nstartBalanceTW4 - ${startBalanceTW4.toString()}\nnextBid - ${nextBid.toString()}`);
            expect(spentTokenWallet4Balance.toString()).to.be.eq(new BigNumber(startBalanceTW4).minus(nextBid).toString());

            const secondBid = await auction.contract.methods.currentBid({}).call();
            expect(secondBid.currentBid.addr.toString()).to.be.eq(account4.address.toString());
            expect(secondBid.currentBid.value.toString()).to.be.eq(nextBid.toString());

            //Finish auction
            await tryIncreaseTime(15);
            await auction.finishAuction(account2, 0, cancelValue);

            const eventAuctionComplete = await auction.getEvent('AuctionComplete');
            expect(eventAuctionComplete).not.to.be.null;

            const ownerChanged = await nft.getEvent('OwnerChanged') as any;
            expect(ownerChanged.newOwner.toString()).to.be.eq(account4.address.toString());

            const managerChanged = await nft.getEvent('ManagerChanged') as any;
            expect(managerChanged.newManager.toString()).to.be.eq(account4.address.toString());

            let owner = (await nft.getInfo()).owner;
            expect(owner.toString()).to.be.eq(account4.address.toString());

            let status = (await auction.getInfo()).status;
            expect(status.toString()).to.be.eq('2');

            let currentRoyaltyFee = new BigNumber(nextBid).div(setRoyalty.denominator).times(setRoyalty.numerator);
            let currentFee = nextBid.div(fee.denominator).times(fee.numerator);
            let currentBurnFee = new BigNumber(currentFee).div(burnFee.denominator).times(burnFee.numerator);

            const RoyaltyWithdrawn = await auction.getEvent("RoyaltyWithdrawn") as any;
            expect(RoyaltyWithdrawn.recipient.toString()).to.be.eq(account4.address.toString())
            expect(RoyaltyWithdrawn.amount.toString()).to.be.eq(currentRoyaltyFee.toString())
            expect(RoyaltyWithdrawn.paymentToken.toString()).to.be.eq(tokenRoot.address.toString())

            console.log('currentFee', currentFee.toNumber());
            console.log('startBalanceTW3', startBalanceTW3);
            const expectedBalance3 = new BigNumber(startBalanceTW3).plus(nextBid).minus(currentFee).minus(currentRoyaltyFee);
            console.log('expectedBalance3', expectedBalance3.toNumber());
            console.log('nextBid', nextBid.toNumber());
            spentTokenWallet2Balance = await tokenWallet2.balance() as any;
            expect(spentTokenWallet2Balance.toString()).to.be.eq((startBalanceTW2).toString());

            let spentTokenWallet3Balance = await tokenWallet3.balance() as any;
            console.log('spentTokenWallet3Balance', spentTokenWallet3Balance);
            expect(spentTokenWallet3Balance.toString()).to.be.eq(expectedBalance3.toString());

            spentTokenWallet4Balance = await tokenWallet4.balance() as any;
            expect(spentTokenWallet4Balance.toString()).to.be.eq((new BigNumber(startBalanceTW4).minus(nextBid).plus(currentRoyaltyFee)).toString());

            const auctionRootTokenWalletBalance = await auctionRootTW.balance();
            expect(auctionRootTokenWalletBalance.toString()).to.be.eq(startBalanceTWAuctionRoot.plus(currentFee).minus(currentBurnFee).toString());

            startBalanceTW3 = new BigNumber(startBalanceTW3).plus(nextBid).minus(currentFee).toNumber();
            startBalanceTW4 = new BigNumber(startBalanceTW4).minus(nextBid).plus(currentRoyaltyFee).toNumber();
            startBalanceTWAuctionRoot = startBalanceTWAuctionRoot.plus(currentFee).minus(currentBurnFee);
        });
    });
});
