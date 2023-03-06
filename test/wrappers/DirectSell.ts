import {Address, Contract, toNano} from "locklift";
import { FactorySource } from "../../build/factorySource";
import { Token } from "./token";
import { Account } from "everscale-standalone-client/nodejs";
import { NftC } from "./nft";

export class FactoryDirectSell {
    public contract: Contract<FactorySource["FactoryDirectSell"]>;
    public owner: Account;
    public address: Address;

    constructor(auction_contract: Contract<FactorySource["FactoryDirectSell"]>, auction_owner: Account) {
        this.contract = auction_contract;
        this.owner = auction_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: Account) {
        const contract = await locklift.factory.getDeployedContract('FactoryDirectSell', addr);
        return new FactoryDirectSell(contract, owner);
    }

    async buildPayload(callbackId:number, startTime: any, endTime:any, paymentToken: Token, price: any, recipient: Address) {
        return (await this.contract.methods.buildDirectSellCreationPayload({
            callbackId: callbackId,
            _startTime: startTime,
            durationTime: endTime,
            _paymentToken: paymentToken.address,
            _price: price,
            recipient: recipient
        }).call()).value0;
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

export class DirectSell {
    public contract: Contract<FactorySource["DirectSell"]>;
    public owner: Account;
    public address: Address;

    constructor(auction_contract: Contract<FactorySource["DirectSell"]>, auction_owner: Account) {
        this.contract = auction_contract;
        this.owner = auction_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: Account) {
        const contract = await locklift.factory.getDeployedContract('DirectSell', addr);
        return new DirectSell(contract, owner);
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

    async closeSell(callbackId: number, gasValue: any) {
        return await locklift.tracing.trace(this.contract.methods.closeSell({
                callbackId
            }).send({
            from: this.owner.address,
            amount: gasValue
        }));
    }
    async finishSell(initiator: Account, callbackId: number, gasValue: any) {
        return await this.contract.methods.finishSell({
                sendGasTo: initiator.address,
                callbackId
            }).send({
            from:initiator.address,
            amount: gasValue
        })
    }
}
