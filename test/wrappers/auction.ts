import {Address, Contract, toNano} from "locklift";
import { FactorySource } from "../../build/factorySource";
import { Token } from "./token";
import { Account } from "everscale-standalone-client/nodejs";

export class AuctionRoot {
    public contract: Contract<FactorySource["FactoryAuction"]>;
    public owner: Account;
    public address: Address;

    constructor(auction_contract: Contract<FactorySource["FactoryAuction"]>, auction_owner: Account) {
        this.contract = auction_contract;
        this.owner = auction_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: Account) {
        const contract = await locklift.factory.getDeployedContract('FactoryAuction', addr);
        return new AuctionRoot(contract, owner);
    }

    async buildPayload(callbackId: number, paymentToken: Token, price: any, auctionStartTime: any, auctionDuration: any, dCollection?: Address, dNftId?: number ) {
        return (await this.contract.methods.buildAuctionCreationPayload({
            answerId: 0,
            _callbackId: callbackId,
            _paymentToken: paymentToken.address,
            _price: price,
            _auctionStartTime: auctionStartTime,
            _auctionDuration: auctionDuration,
            _discountCollection: dCollection || null,
            _discountNftId: typeof(dNftId) === "undefined" ? null : dNftId
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

    async withdraw(
        tokenWallet: Address,
        amount: number,
        recipient: Address,
        remainingGasTo: Address,
        initiator: Address
    ) {
        return (await this.contract.methods.withdraw({
            _tokenWallet: tokenWallet,
            _amount: amount,
            _recipient: recipient,
            _remainingGasTo: remainingGasTo
        }).send({
            from: initiator,
            amount: toNano(2)
        }))
    }
}

export class Auction {
    public contract: Contract<FactorySource["Auction"]>;
    public owner: Account;
    public address: Address;

    constructor(auction_contract: Contract<FactorySource["Auction"]>, auction_owner: Account) {
        this.contract = auction_contract;
        this.owner = auction_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: Account) {
        const contract = await locklift.factory.getDeployedContract('Auction', addr);
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
                _remainingGasTo: initiator.address,
                _callbackId: callbackId}).send({
                from: initiator.address,
                amount: gasValue
            }
        ),{allowedCodes:{compute:[null]}});
    }

    async getInfo() {
        return (await this.contract.methods.getInfo({}).call()).value0;
    }

    async buildPayload(callbackId: number, buyer: Account) {
        return (await this.contract.methods.buildPlaceBidPayload({answerId: 0, _callbackId: callbackId, _buyer: buyer.address}).call()).value0;
    }

}
