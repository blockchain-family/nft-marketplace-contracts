import {Address, Contract} from "locklift";
import {TokenWallet} from "./token_wallet";
import {FactorySource} from "../../build/factorySource";
import {Account} from "locklift/build/factory";

const logger = require("mocha-logger");


declare type AccountType = Account<FactorySource["Wallet"]>;


export class Token {
    public contract: Contract<FactorySource["TokenRootUpgradeable"]>;
    public owner: AccountType;
    public address: Address;

    constructor(token_contract: Contract<FactorySource["TokenRootUpgradeable"]>, token_owner: AccountType) {
        this.contract = token_contract;
        this.owner = token_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: AccountType) {
        const contract = await locklift.factory.getDeployedContract('TokenRootUpgradeable', addr);
        return new Token(contract, owner);
    }

    async walletAddr(user: Address) {
        return (await this.contract.methods.walletOf({walletOwner: user, answerId: 0}).call()).value0;
    }

    async wallet(user: AccountType) {
        const wallet_addr = await this.walletAddr(user.address);
        return await TokenWallet.from_addr(wallet_addr, user);
    }

    async deployWallet(user: AccountType) {
        const token = this.contract;
        await user.runTarget(
            {
                contract: token,
                value: locklift.utils.toNano(2),
            },
            (token) => token.methods.deployWallet({
                answerId: 0,
                walletOwner: user.address,
                deployWalletValue: locklift.utils.toNano(1)
            })
        );

        const addr = await this.walletAddr(user.address);
        logger.log(`User token wallet: ${addr.toString()}`);
        return await TokenWallet.from_addr(addr, user);
    }

    async mint(mint_amount: any, user: AccountType) {
        await locklift.tracing.trace(this.owner.runTarget(
            {
                contract: this.contract,
                value: locklift.utils.toNano(5),
            },
            (token) => token.methods.mint({
                amount: mint_amount,
                recipient: user.address,
                deployWalletValue: locklift.utils.toNano(1),
                remainingGasTo: this.owner.address,
                notify: false,
                payload: ''
            })
        ));

        const walletAddr = await this.walletAddr(user.address);
        logger.log(`User token wallet: ${walletAddr.toString()}`);
        return await TokenWallet.from_addr(walletAddr, user);
    }
}
