import {Address, Contract, toNano} from "locklift";
import { FactorySource } from "../../build/factorySource";
import { Token } from "./token";
import { Account } from "everscale-standalone-client/nodejs";

export class AuctionRoot {
    public contract: Contract<FactorySource["AuctionRootTip3"]>;
    public owner: Account;
    public address: Address;

    constructor(auction_contract: Contract<FactorySource["AuctionRootTip3"]>, auction_owner: Account) {
        this.contract = auction_contract;
        this.owner = auction_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: Account) {
        const contract = await locklift.factory.getDeployedContract('AuctionRootTip3', addr);
        return new AuctionRoot(contract, owner);
    }

    async buildPayload(callbackId: number, paymentToken: Token, price: any, auctionStartTime: any, auctionDuration: any) {
        return (await this.contract.methods.buildAuctionCreationPayload({callbackId: callbackId, paymentToken: paymentToken.address, price: price, auctionStartTime: auctionStartTime, auctionDuration: auctionDuration, answerId: 0}).call()).value0;
    }

    async getEvents(event_name: string) {
        return (await this.contract.getPastEvents({filter: (event) => event.event === event_name})).events;
    }

    async getEvent(event_name: string) {
        const last_event = (await this.getEvents(event_name)).shift();
        if (last_event) {
            return last_event.data;
        }
        return null;
    }
}

export class Auction {
    public contract: Contract<FactorySource["AuctionTip3"]>;
    public owner: Account;
    public address: Address;

    constructor(auction_contract: Contract<FactorySource["AuctionTip3"]>, auction_owner: Account) {
        this.contract = auction_contract;
        this.owner = auction_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: Account) {
        const contract = await locklift.factory.getDeployedContract('AuctionTip3', addr);
        return new Auction(contract, owner);
    }

    async getEvents(event_name: string) {
        return (await this.contract.getPastEvents({ filter: (event) => event.event === event_name })).events;
    }

    async getEvent(event_name: string) {
        const last_event = (await this.getEvents(event_name)).shift();
        if (last_event) {
            return last_event.data;
        }
        return null;
    }

    async finishAuction(initiator: Account, callbackId: number, gasValue: any) {
        return await locklift.tracing.trace(this.contract.methods.finishAuction({
                sendGasTo: initiator.address,
                callbackId}).send({
                from: initiator.address,
                amount: gasValue
            }
        ));
    }

    async getInfo() {
        return (await this.contract.methods.getInfo({}).call()).value0;
    }

    async buildPayload(callbackId: number, buyer: Account) {
        return (await this.contract.methods.buildPlaceBidPayload({answerId: 0, callbackId: callbackId, buyer: buyer.address}).call()).value0;
    }
}
