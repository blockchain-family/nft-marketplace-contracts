import {Address, Contract} from "locklift";
import {FactorySource} from "../../build/factorySource";
import {Account} from "locklift/build/factory";

const {toNano} = locklift.utils;


declare type AccountType = Account<FactorySource["Wallet"]>;


export class TokenWallet {
    public contract: Contract<FactorySource["TokenWallet"]>;
    public _owner: AccountType | null;
    public address: Address;
    public name: string | undefined;

    constructor(wallet_contract: Contract<FactorySource["TokenWallet"]>, wallet_owner: AccountType | null) {
        this.contract = wallet_contract;
        this._owner = wallet_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: AccountType | null) {
        const wallet = await locklift.factory.getDeployedContract('TokenWallet', addr);
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

    async transfer(amount: number, receiver: Address, notify: boolean, payload = '', value: any) {
        const owner = this._owner as AccountType;
        return await owner.runTarget(
            {
                contract: this.contract,
                value: value || toNano(5)
            },
            (token) => token.methods.transfer({
                amount: amount,
                recipient: receiver,
                deployWalletValue: 0,
                remainingGasTo: owner.address,
                notify: notify,
                payload: payload
            })
        );
    }
}
