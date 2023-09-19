import {Address, Contract} from "locklift";
import {FactorySource} from "../../build/factorySource";
import { Account } from "everscale-standalone-client/nodejs";

const {toNano} = locklift.utils;


export class TokenWallet {
    public contract: Contract<FactorySource["VaultTokenWallet_V1"]>;
    public _owner: Account | null;
    public address: Address;
    public name: string | undefined;

    constructor(wallet_contract: Contract<FactorySource["VaultTokenWallet_V1"]>, wallet_owner: Account | null) {
        this.contract = wallet_contract;
        this._owner = wallet_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: Account | null) {
        const wallet = await locklift.factory.getDeployedContract('VaultTokenWallet_V1', addr);
        return new TokenWallet(wallet, owner);
    }

    async owner() {
        return await this.contract.methods.owner({answerId: 0}).call();
    }

    async root() {
        return await this.contract.methods.root({answerId: 0}).call();
    }

    async balance() {
        return (await this.contract.methods.balance({answerId: 0}).call()).value0;
    }

    async balanceSafe() {
        let balance = '0';
        await this.contract.methods.balance({answerId: 0})
            .call()
            .then(r => balance = r.value0)
            .catch(e => {/* ignored */});
        return balance;
    }

    async acceptNative(amount: number, from: Address, deployWalletValue: string|number, remainingGasTo: Address, payload = '', gasValue: any) {
        console.log(gasValue);
        return await locklift.tracing.trace(
                 this.contract.methods.acceptNative({
                    amount: amount,
                    deployWalletValue: deployWalletValue,
                    remainingGasTo: remainingGasTo,
                    payload: payload
            }).send({
                from: from,
                amount: gasValue.toString()
        }),{allowedCodes:{compute:[null]}});
    }
    async transfer(amount: number, receiver: Address, deployWalletValue: string|number, notify: boolean, payload = '', gasValue: any) {
        const owner = this._owner as Account;
        return await locklift.tracing.trace(
                 this.contract.methods.transfer({
                    amount: amount,
                    recipient: receiver,
                    deployWalletValue: deployWalletValue,
                    remainingGasTo: owner.address,
                    notify: notify,
                    payload: payload
            }).send({
                from: owner.address,
                amount: gasValue
        }),{allowedCodes:{compute:[null]}});
    }
}
