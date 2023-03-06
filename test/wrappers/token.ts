import {Address, Contract, toNano} from "locklift";
import {TokenWallet} from "./token_wallet";
import {FactorySource} from "../../build/factorySource";
import { Account } from "everscale-standalone-client/nodejs";

const logger = require("mocha-logger");


export class Token {
    public contract: Contract<FactorySource["TokenRootUpgradeable"]>;
    public owner: Account;
    public address: Address;

    constructor(token_contract: Contract<FactorySource["TokenRootUpgradeable"]>, token_owner: Account) {
        this.contract = token_contract;
        this.owner = token_owner;
        this.address = this.contract.address;
    }

    static async from_addr(addr: Address, owner: Account) {
        const contract = await locklift.factory.getDeployedContract('TokenRootUpgradeable', addr);
        return new Token(contract, owner);
    }

    async walletAddr(user: Address) {
        return (await this.contract.methods.walletOf({walletOwner: user, answerId: 0}).call()).value0;
    }

    async wallet(user: Account) {
        const wallet_addr = await this.walletAddr(user.address);
        return await TokenWallet.from_addr(wallet_addr, user);
    }

    async deployWallet(user: Account) {
        this.contract.methods.deployWallet({
            answerId: 0,
            walletOwner: user.address,
            deployWalletValue: toNano(1)
        }).send({
            from:user.address,
            amount: toNano(2)
        });

        const addr = await this.walletAddr(user.address);
        logger.log(`User token wallet: ${addr.toString()}`);
        return await TokenWallet.from_addr(addr, user);
    }
    //new BigNumber(1000).shiftedBy(9).toString()
    async mint(mint_amount: any, user: Account) {
        await locklift.tracing.trace(
            this.contract.methods.mint({
                amount: mint_amount,
                recipient: user.address,
                deployWalletValue: toNano(1),
                remainingGasTo: this.owner.address,
                notify: false,
                payload: ''
            }).send({
                from: this.owner.address,
                amount: toNano(5)
            }));

        const walletAddr = await this.walletAddr(user.address);
        logger.log(`User token wallet: ${walletAddr.toString()}`);
        return await TokenWallet.from_addr(walletAddr, user);
    }
}
