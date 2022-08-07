import { Migration } from "./migration";

const prompts = require('prompts');
const migration = new Migration();
const {isValidTonAddress} = require(process.cwd() + '/test/utils');

async function main() {
    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'FactoryDirectBuy owner',
            validate: value => isValidTonAddress(value) || value === '' ? true : 'Invalid Everscale address'
        }
    ]);

    const account = migration.load("Wallet", "Account1");
    const signer = (await locklift.keystore.getSigner('0'));

    const DirectBuy = (await locklift.factory.getContractArtifacts("DirectBuy"));
    const TokenWalletPlatform = (await locklift.factory.getContractArtifacts("TokenWalletPlatform"));

    const {contract: factoryDirectBuy, tx } = await locklift.factory.deployContract({
        contract: "FactoryDirectBuy",
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _owner: account.address,
            sendGasTo: account.address    
        },
        initParams: {
            nonce_: Math.random() * 6400 | 0,
            tokenPlatformCode: TokenWalletPlatform.code,
            directBuyCode: DirectBuy.code
        },
        value: locklift.utils.toNano(10)
    }); 

    console.log(`FactoryDirectBuy: ${factoryDirectBuy.address}`);
    migration.store(factoryDirectBuy.address, "FactoryDirectBuy", "FactoryDirectBuy");

    if (response.owner) {
        const accountFactory = locklift.factory.getAccountsFactory("Wallet");
        const acc = accountFactory.getAccount(account.address, (signer?.publicKey) as string);
        await acc.runTarget(
            {
                contract: factoryDirectBuy,
                value: locklift.utils.toNano(1),
            },
            (directBuy) => directBuy.methods.transferOwnership({
                    newOwner: response.owner
            }),
        );
    }
}

main()
.then(() => process.exit(0))
.catch(e => {
    console.log(e);
    process.exit(1);
});