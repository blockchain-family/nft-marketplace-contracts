import { Account } from "locklift/build/factory";
import { Address, Contract } from "locklift";
import { FactorySource } from "../../build/factorySource";
import { NftC } from "./nft";

declare type AccountType = Account<FactorySource["Wallet"]>

export class FactoryDirectBuy {
    public contract: Contract<FactorySource["FactoryDirectBuy"]>;
    public owner: AccountType;
    public address: Address;

    constructor(auction_contract: Contract<FactorySource["FactoryDirectBuy"]>, auction_owner: AccountType) {
        this.contract = auction_contract;
        this.owner = auction_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: AccountType) {
        const contract = await locklift.factory.getDeployedContract('FactoryDirectBuy', addr);
        return new FactoryDirectBuy(contract, owner);
    }

    async buildPayload(callbackId:number, nft: NftC, startTime: any, durationTime: any) {
        return (await this.contract.methods.buildDirectBuyCreationPayload({callbackId: callbackId, nft: nft.address, startTime: startTime, durationTime: durationTime}).call()).value0;
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
    public owner: AccountType;
    public address: Address;

    constructor(auction_contract: Contract<FactorySource["DirectBuy"]>, auction_owner: AccountType) {
        this.contract = auction_contract;
        this.owner = auction_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: AccountType) {
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

    async finishBuy(initiator: AccountType) {
        return await initiator.runTarget(
            {
                contract: this.contract,
                value: locklift.utils.toNano(2),
                flags: 1
            },
            (dd) => dd.methods.finishBuy({
                sendGasTo: initiator.address
            })
        );
    }

    async closeBuy() {
        return await this.owner.runTarget(
            {
                contract: this.contract,
                value: locklift.utils.toNano(1)
            },
            (cc) => cc.methods.closeBuy({})
        );
    }
}
