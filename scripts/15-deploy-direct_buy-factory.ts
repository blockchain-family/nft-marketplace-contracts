import { Migration } from "./migration";
import { isValidEverAddress} from "../test/utils";

const prompts = require('prompts');
const migration = new Migration();

async function main() {
    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'FactoryDirectBuy owner',
            validate: (value:any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address'
        },
        {
            type: 'text',
            name: 'weverRoot',
            message: 'Wever root address',
            validate: (value:any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address'
        },
        {
            type: 'text',
            name: 'weverVault',
            message: 'Wever vault address',
            validate: (value:any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address'
        }
    ]);

    const account = await migration.loadAccount('Account1');
    const signer = (await locklift.keystore.getSigner('0'));

    let fee = {
        numerator: 2,
        denominator: 100
    }

    const {contract: factoryDirectBuy, tx } = await locklift.factory.deployContract({
        contract: "FactoryDirectBuy",
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _owner: account.address,
            sendGasTo: account.address,
            _fee: fee,
            _weverVault: response.weverVault,
            _weverRoot: response.weverRoot
        },
        initParams: {
            nonce_: Math.random() * 6400 | 0
        },
        value: locklift.utils.toNano(10)
    });

    console.log(`FactoryDirectBuy: ${factoryDirectBuy.address}`);
    migration.store(factoryDirectBuy, "FactoryDirectBuy");

    const DirectBuy = (await locklift.factory.getContractArtifacts('DirectBuy'));
    const TokenWalletPlatform = (await locklift.factory.getContractArtifacts('TokenWalletPlatform'));

    console.log(`Set code TokenWalletPlatform`);

    await factoryDirectBuy.methods.setCodeTokenPlatform({
        _tokenPlatformCode: TokenWalletPlatform.code
    }).send({
        from: account.address,
        amount: locklift.utils.toNano(1)
    })

    console.log(`Set code DirectBuy`)
    await factoryDirectBuy.methods.setCodeDirectBuy({
        _directBuyCode: DirectBuy.code
    }).send({
        from: account.address,
        amount: locklift.utils.toNano(1)
    })

    if (response.owner) {
        await factoryDirectBuy.methods.transferOwnership({
            newOwner: response.owner
        }).send({
            from: account.address,
            amount: locklift.utils.toNano(1)
        })
    }
}

main()
.then(() => process.exit(0))
.catch(e => {
    console.log(e);
    process.exit(1);
});
