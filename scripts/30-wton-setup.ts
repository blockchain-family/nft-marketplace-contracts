import { Migration } from "./migration";
import { isValidEverAddress} from "../test/utils";
import {toNano, WalletTypes, zeroAddress} from "locklift";

const prompts = require('prompts');
const migration = new Migration();
const logger = require("mocha-logger");

async function main() {

    console.log(`30-wton-setup.js`);
        const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'Contracts owner',
            validate: (value:any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address'
        }]);

    const signer = (await locklift.keystore.getSigner('0'));
    const account = await migration.loadAccount('Account1');

    const { contract: tunnel, tx } = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: 'TestWeverTunnel',
        initParams: {
            _randomNonce: locklift.utils.getRandomNonce(),
        },
        publicKey: signer?.publicKey as string,
        constructorParams: {
            sources: [],
            destinations: [],
            owner_: account.address,
        },
        value: toNano(5)
    }));

    logger.success(`Tunnel address: ${tunnel.address}`);

    const tokenData =  {
      name: 'Wrapped EVER',
      symbol: 'WEVER',
      decimals: 9
    }

    const TokenWallet = await locklift.factory.getContractArtifacts('TokenWalletUpgradeable');
    const TokenWalletPlatform = await locklift.factory.getContractArtifacts('TokenWalletPlatform');

     const { contract: _root, tx } = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: 'TokenRootUpgradeable',
        initParams: {
            name_: tokenData.name,
            symbol_: tokenData.symbol,
            decimals_: tokenData.decimals,
            rootOwner_: tunnel.address,
            walletCode_: TokenWallet.code,
            randomNonce_: locklift.utils.getRandomNonce(),
            deployer_: zeroAddress,
            platformCode_: TokenWalletPlatform.code
        },
        publicKey: signer?.publicKey as string,
        constructorParams: {
            initialSupplyTo: zeroAddress,
            initialSupply: 0,
            deployWalletValue: 0,
            mintDisabled: false,
            burnByRootDisabled: false,
            burnPaused: false,
            remainingGasTo: zeroAddress
        },
        value: toNano(2)
    }));

    logger.success(`Wever root address: ${_root.address.toString()}`);

    const { contract: vault, tx } = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: 'TestWeverVault',
        initParams: {
            _randomNonce: locklift.utils.getRandomNonce(),
        },
        publicKey: signer?.publicKey as string,
        constructorParams: {
            owner_: account.address,
            root_tunnel: tunnel.address,
            root: _root.address,
            receive_safe_fee: toNano(1),
            settings_deploy_wallet_grams: toNano(0.1),
            initial_balance: toNano(1)
        },
        value: toNano(2)
    }));

    logger.success(`Vault address: ${vault.address}`);

    await tunnel.methods.__updateTunnel({
            source: vault.address,
            destination: _root.address,
        }).send({
        from: account.address,
        amount: toNano(1)
    });

    await vault.methods.drain({
            receiver: account.address,
        }).send({
        from: account.address,
        amount: toNano(1)
    });

    if (response.owner) {
        await tunnel.methods.transferOwnership({
            newOwner: response.owner
        }).send({
          from: account.address,
          amount: locklift.utils.toNano(1)
        });
        await vault.methods.transferOwnership({
            newOwner: response.owner
        }).send({
          from: account.address,
          amount: locklift.utils.toNano(1)
        });
        // await _root.methods.transferOwnership({
        //     newOwner: response.owner
        // }).send({
        //   from: account.address,
        //   amount: locklift.utils.toNano(1)
        // });
    }
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
