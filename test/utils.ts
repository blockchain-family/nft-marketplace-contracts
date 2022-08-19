import {Account} from "locklift/build/factory";
import {FactorySource} from "../build/factorySource";

const logger = require("mocha-logger");
const {expect} = require("chai");

export declare type AccountType = Account<FactorySource["Wallet"]>;

export const deployAccount = async function (key_number = 0, initial_balance = 10) {
    const signer = await locklift.keystore.getSigner(`${key_number}`);
    let accountsFactory = locklift.factory.getAccountsFactory('Wallet');
    
    const {account: wallet} = await accountsFactory.deployNewAccount({
        publicKey: (signer?.publicKey) as string,
        value: locklift.utils.toNano(initial_balance).toString(),
        initParams: {
            _randomNonce: locklift.utils.getRandomNonce(),
        },
        constructorParams: {}
    });

    const walletBalance = await locklift.provider.getBalance(wallet.address);
    expect(Number(wallet)).to.be.above(0, 'Bad user balance');

    logger.log(`User address: ${wallet.address.toString()}`);

    return wallet;
}