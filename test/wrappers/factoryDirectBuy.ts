import { Address, Contract } from "locklift";
import { FactorySource } from "../../build/factorySource";
import {Account} from "locklift/build/factory";
import { Token } from "./token";
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

    async buildPayload(nft: NftC, startTime: any, durationTime: any) {
        return (await this.contract.methods.buildPayload({nft: nft.address, startTime: startTime, durationTime: durationTime}).call()).value0;
    }
    
    async getEvents(event_name: string) {
        return (await this.contract.getPastEvents({filter: (event) => event.event === event_name})).events;
    }
    
    async getEvent(event_name: string) {
        // return (await this.contract.waitForEvent({filter: (event) => event.event == event_name}))?.data;
        const last_event = (await this.getEvents(event_name)).shift();
        if (last_event) {
            return last_event.data;
        }
        return null;
    }
}