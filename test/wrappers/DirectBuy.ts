import { Address, Contract } from "locklift";
import { FactorySource } from "../../build/factorySource";
import {Account} from "locklift/build/factory";

declare type AccountType = Account<FactorySource["Wallet"]>

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
}
