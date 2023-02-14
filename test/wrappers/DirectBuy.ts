import {Address, Contract, toNano} from "locklift";
import { FactorySource } from "../../build/factorySource";
import { NftC } from "./nft";
import { Account } from "everscale-standalone-client/nodejs";

export class FactoryDirectBuy {
    public contract: Contract<FactorySource["FactoryDirectBuy"]>;
    public owner: Account;
    public address: Address;

    constructor(auction_contract: Contract<FactorySource["FactoryDirectBuy"]>, auction_owner: Account) {
        this.contract = auction_contract;
        this.owner = auction_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: Account) {
        const contract = await locklift.factory.getDeployedContract('FactoryDirectBuy', addr);
        return new FactoryDirectBuy(contract, owner);
    }

    async buildPayload(callbackId:number, buyer: Account, nft: NftC, startTime: any, durationTime: any) {
        return (await this.contract.methods.buildDirectBuyCreationPayload({callbackId: callbackId,buyer: buyer.address,nft: nft.address, startTime: startTime, durationTime: durationTime}).call()).value0;
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

export class DirectBuy {
    public contract: Contract<FactorySource["DirectBuy"]>;
    public owner: Account;
    public address: Address;

    constructor(auction_contract: Contract<FactorySource["DirectBuy"]>, auction_owner: Account) {
        this.contract = auction_contract;
        this.owner = auction_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: Account) {
        const contract = await locklift.factory.getDeployedContract('DirectBuy', addr);
        return new DirectBuy(contract, owner);
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

    async getInfo() {
        return (await this.contract.methods.getInfo({}).call()).value0;
    }

    async finishBuy(initiator: Account, callbackId: number, gasValue: any) {
        return await locklift.tracing.trace(this.contract.methods.finishBuy({
                sendGasTo: initiator.address,
                callbackId
            }).send({
                from: initiator.address,
                amount: gasValue
        }));
    }

    async closeBuy(callbackId: number, gasValue: any) {
        return await locklift.tracing.trace(this.contract.methods.closeBuy({
                callbackId
            }).send({
            from: this.owner.address,
            amount: gasValue
        }));
    }
}
