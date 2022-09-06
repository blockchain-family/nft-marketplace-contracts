import { Address, Contract } from "locklift";
import { FactorySource } from "../../build/factorySource";
import {Account} from "locklift/build/factory";
import { Token } from "./token";
import { NftC } from "./nft";

declare type AccountType = Account<FactorySource["Wallet"]>

export class FactoryDirectSell {
    public contract: Contract<FactorySource["FactoryDirectSell"]>;
    public owner: AccountType;
    public address: Address;

    constructor(auction_contract: Contract<FactorySource["FactoryDirectSell"]>, auction_owner: AccountType) {
        this.contract = auction_contract;
        this.owner = auction_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: AccountType) {
        const contract = await locklift.factory.getDeployedContract('FactoryDirectSell', addr);
        return new FactoryDirectSell(contract, owner);
    }

    async buildPayload(nft:NftC, startTime: any, endTime:any, paymentToken: Token, price: any) {
        return (await this.contract.methods.buildPayload({_nftAddress: nft.address, _startTime: startTime, _endTime: endTime, _paymentToken: paymentToken.address, _price:price}).call()).value0;
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