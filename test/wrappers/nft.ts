import { Account } from "everscale-standalone-client/nodejs";
import { CallbackType } from "../utils";
import {AbiEventName, Address, Contract, DecodedAbiEventData, toNano, zeroAddress} from "locklift";
import {AuctionAbi, FactoryAuctionAbi, FactorySource, NftWithRoyaltyAbi} from "../../build/factorySource";

export class NftC {
    public contract: Contract<FactorySource["Nft"]>;
    public owner: Account;
    public address: Address;

    constructor(nft_contract: Contract<FactorySource["Nft"]>, nft_owner: Account) {
        this.contract = nft_contract;
        this.owner = nft_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: Account) {
        const contract = await locklift.factory.getDeployedContract('Nft', addr);
        return new NftC(contract, owner);
    }

    async getInfo() {
        return (await this.contract.methods.getInfo({answerId: 0}).call());
    }

    async changeManager(initiator: Account, newManager: Address, sendGasTo: Address, callbacks: CallbackType[], gasValue: any) {
        return await locklift.tracing.trace(this.contract.methods.changeManager({
                newManager,
                sendGasTo: sendGasTo == zeroAddress ? this.owner.address: sendGasTo,
                callbacks
            }).send({
            from: initiator.address,
            amount: gasValue
        }),{allowedCodes:{compute:[null]}});
    }

    async getEvents(event_name: string) {
        return (await this.contract.getPastEvents({filter: (event) => event.event === event_name})).events;
    }

    async getEvent<T extends AbiEventName<NftWithRoyaltyAbi>>(event_name: T): Promise<DecodedAbiEventData<NftWithRoyaltyAbi, T>> {
        const last_event = (await this.getEvents(event_name)).shift();
        // @ts-ignore
        return last_event.data;
    }
}
