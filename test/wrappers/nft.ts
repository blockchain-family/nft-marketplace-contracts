import { Account } from "locklift/build/factory";
import { CallbackType } from "../utils";
import {Address, Contract, toNano, zeroAddress} from "locklift";
import { FactorySource } from "../../build/factorySource";

declare type AccountType = Account<FactorySource["Wallet"]>

export class NftC {
    public contract: Contract<FactorySource["Nft"]>;
    public owner: AccountType;
    public address: Address;

    constructor(nft_contract: Contract<FactorySource["Nft"]>, nft_owner: AccountType) {
        this.contract = nft_contract;
        this.owner = nft_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: AccountType) {
        const contract = await locklift.factory.getDeployedContract('Nft', addr);
        return new NftC(contract, owner);
    }

    async getInfo() {
        return (await this.contract.methods.getInfo({answerId: 0}).call());
    }

    async changeManager(initiator: AccountType, newManager: Address, sendGasTo: Address, callbacks: CallbackType[]) {
        return await this.contract.methods.changeManager({
                newManager,
                sendGasTo: sendGasTo == zeroAddress ? this.owner.address: sendGasTo,
                callbacks       
            }).send({
            from: initiator.address,
            amount: toNano(5)
        });
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