import { FactorySource } from "../build/factorySource";
import {Address, Contract, zeroAddress, WalletTypes, toNano, getRandomNonce} from "locklift";
import { Account } from "everscale-standalone-client/nodejs";
import { Token } from "./wrappers/token";
import { AuctionRoot } from "./wrappers/auction";
import { NftC } from "./wrappers/nft";
import { FactoryDirectBuy } from "./wrappers/DirectBuy";
import { FactoryDirectSell } from "./wrappers/DirectSell";

const fs = require('fs')
const logger = require("mocha-logger");
const { expect } = require("chai");

type MarketFee = {
    numerator: string;
    denominator: string;
}

export type AddressN = `0:${string}`
export const isValidEverAddress = (address: string): address is AddressN => /^(?:-1|0):[0-9a-fA-F]{64}$/.test(address);
export declare type CollectionType = Contract<FactorySource["Collection"]>;

export type CallbackType = [Address, {
    value: string | number;
} & {
    payload: string;
}];

export async function sleep(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const deployAccount = async function (key_number = 0, initial_balance = 10) {
    const signer = (await locklift.keystore.getSigner(key_number.toString()))!;
    const { account } = (await locklift.factory.accounts.addNewAccount({
    type: WalletTypes.EverWallet, // or WalletTypes.HighLoadWallet,
    //Value which will send to the new account from a giver
    value: toNano(initial_balance),
    //owner publicKey
    publicKey: signer!.publicKey,
    nonce: getRandomNonce()
    }));

    await locklift.provider.sendMessage({
        sender: account.address,
        recipient: account.address,
        amount: toNano(0.1),
        bounce: false
    });

    const accountBalance = await locklift.provider.getBalance(account.address);
    expect(Number(accountBalance)).to.be.above(0, 'Bad user balance');

    logger.log(`User address: ${account.address.toString()}`);

    return account;
}

export const deployCollectionAndMintNft = async function (account: Account, remainOnNft: 1, pathJsonFile: "nft_to_address.json", accForNft: Account[]) {
    const Nft = (await locklift.factory.getContractArtifacts("Nft"));
    const Index = (await locklift.factory.getContractArtifacts("Index"));
    const IndexBasis = (await locklift.factory.getContractArtifacts("IndexBasis"));
    const signer = await locklift.keystore.getSigner('0');

    remainOnNft = remainOnNft || 0;
    accForNft = accForNft || "";

    let array_json: any;
    const data = fs.readFileSync(pathJsonFile, 'utf8');
    if (data) array_json = JSON.parse(data);

    const { contract: collection } = await locklift.factory.deployContract({
        contract: "Collection",
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            codeNft: Nft.code,
            codeIndex: Index.code,
            codeIndexBasis: IndexBasis.code,
            owner: account.address,
            remainOnNft: toNano(remainOnNft),
            json: JSON.stringify(array_json.collection)
        },
        initParams: {
            nonce_: locklift.utils.getRandomNonce()
        },
        value: toNano(5)
    });

    logger.log(`Collection address: ${collection.address.toString()}`);

    let nftMinted : NftC[] = [];

    if (array_json.nfts) {
        let ch = 0;
        for (const element of array_json.nfts) {
            let item = {
                "type": "Basic NFT",
                "name": element.name,
                "description": element.description,
                "preview": {
                    "source": element.preview_url,
                    "mimetype": "image/png"
                },
                "files": [
                    {
                        "source": element.url,
                        "mimetype": "image/png"
                    }
                ],
                "external_url": "https://"
            }
            let payload = JSON.stringify(item);

            const tx = await locklift.transactions.waitFinalized(
                 collection.methods.mintNft ({
                _owner: accForNft[ch].address,
                _json: payload
                 }).send({
                        from: account.address,
                        amount: toNano(6),
                 })
            );

            // console.log('tx:' + tx.id.hash);

            let totalMinted = await collection.methods.totalMinted({ answerId: 0 }).call();
            let nftAddress = await collection.methods.nftAddress({ answerId: 0, id: (Number(totalMinted.count) - 1).toFixed() }).call();
            let nftCN = await NftC.from_addr(nftAddress.nft, accForNft[ch]);
            nftMinted.push(nftCN);
            logger.log(`Nft address: ${nftAddress.nft.toString()}, owner: ${accForNft[ch].address.toString()}`);
            ch++;
        }
    }

    return [collection, nftMinted] as const;
}
export const deployNFT = async function (account: Account, collection: CollectionType, nft_name: string, nft_description: string, nft_url: string, externalUrl: string, ownerNFT = account) {
    let item = {
        "type": "Basic NFT",
        "name": nft_name,
        "description": nft_description,
        "preview": {
            "source": nft_url,
            "mimetype": "image/png"
        },
        "files": [
            {
                "source": nft_url,
                "mimetype": "image/png"
            }
        ],
        "external_url": externalUrl
    }
    let payload = JSON.stringify(item)

    const collectionNFT = locklift.factory.getDeployedContract("Collection", collection.address);

    await locklift.tracing.trace(
        collectionNFT.methods.mintNft({
            _owner: ownerNFT.address,
            _json: payload
        }).send({
            from: account.address,
            amount: toNano(2)
        }));

    let totalMinted = await collectionNFT.methods.totalMinted({ answerId: 0 }).call();
    let nftAddress = await collectionNFT.methods.nftAddress({ answerId: 0, id: (Number(totalMinted.count) - 1).toFixed() }).call();
    return NftC.from_addr(nftAddress.nft, ownerNFT);
}

export const deployTokenRoot = async function (token_name: string, token_symbol: string, owner: Account) {
    const signer = await locklift.keystore.getSigner('0');

    const TokenWallet = await locklift.factory.getContractArtifacts('TokenWalletUpgradeable');
    const TokenWalletPlatform = await locklift.factory.getContractArtifacts('TokenWalletPlatform');
    const { contract: _root, tx } = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: 'TokenRootUpgradeable',
        initParams: {
            name_: token_name,
            symbol_: token_symbol,
            decimals_: 9,
            rootOwner_: owner.address,
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
            remainingGasTo: owner.address
        },
        value: toNano(2)
    }));

    logger.log(`Token root address: ${_root.address.toString()}`);

    expect(Number(await locklift.provider.getBalance(_root.address))).to.be.above(0, 'Root balance empty');
    return new Token(_root, owner);
}

export const deployWeverRoot = async function (token_name: string, token_symbol: string, owner: Account) {
    const signer = (await locklift.keystore.getSigner('0'));

    const { contract: tunnel, tx } = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: 'TestWeverTunnel',
        initParams: {
            _randomNonce: locklift.utils.getRandomNonce(),
        },
        publicKey: signer?.publicKey as string,
        constructorParams: {
            sources: [],
            destinations: [],
            owner_: owner.address,
        },
        value: toNano(5)
    }));

    logger.success(`Tunnel address: ${tunnel.address}`);

    const TokenWallet = await locklift.factory.getContractArtifacts('TokenWalletUpgradeable');
    const TokenWalletPlatform = await locklift.factory.getContractArtifacts('TokenWalletPlatform');

     const { contract: _root } = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: 'TokenRootUpgradeable',
        initParams: {
            name_: token_name,
            symbol_: token_symbol,
            decimals_: 9,
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

    const { contract: vault} = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: 'TestWeverVault',
        initParams: {
            _randomNonce: locklift.utils.getRandomNonce(),
        },
        publicKey: signer?.publicKey as string,
        constructorParams: {
            owner_: owner.address,
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
        from: owner.address,
        amount: toNano(1)
    });

    await vault.methods.drain({
            receiver: owner.address,
        }).send({
        from: owner.address,
        amount: toNano(1)
    });

    return {
        root: new Token(_root, owner),
        vault: vault.address
    };
}

export const deployAuctionRoot = async function (owner: Account, fee: MarketFee, weverVault: Address, weverRoot: Address) {
    const signer = await locklift.keystore.getSigner('0');

    const Nft = (await locklift.factory.getContractArtifacts("Nft"));
    const AuctionTip3 = (await locklift.factory.getContractArtifacts("AuctionTip3"));

    const { contract: auctionRootTip3, tx } = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: 'AuctionRootTip3',
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _codeNft: Nft.code,
            _owner: owner.address,
            _offerCode: AuctionTip3.code,
            _deploymentFee: 0,
            _fee: fee,
            _auctionBidDelta: 500,
            _auctionBidDeltaDecimals: 10000,
            _sendGasTo: owner.address,
            _weverVault: weverVault,
            _weverRoot: weverRoot

        },
        initParams: {
            nonce_: locklift.utils.getRandomNonce(),
        },
        value: toNano(10)
    }));

    logger.log(`Auction Root address ${auctionRootTip3.address.toString()}`);

    return new AuctionRoot(auctionRootTip3, owner);
}

export const deployFactoryDirectBuy = async function (owner: Account, fee: MarketFee, weverVault: Address, weverRoot: Address) {
    const signer = await locklift.keystore.getSigner('0');
    const {contract: factoryDirectBuy} = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: "FactoryDirectBuy",
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _owner: owner.address,
            sendGasTo: owner.address,
            _fee: fee,
            _weverVault: weverVault,
            _weverRoot: weverRoot
        },
        initParams: {
            nonce_: getRandomNonce()
        },
        value: toNano(10)
    }));

    logger.log(`FactoryDirectBuy address ${factoryDirectBuy.address.toString()}`);

    const TokenWalletPlatform = await locklift.factory.getContractArtifacts('TokenWalletPlatform');
    const DirectBuy = await locklift.factory.getContractArtifacts('DirectBuy');
    await factoryDirectBuy.methods.setCodeTokenPlatform({
            _tokenPlatformCode: TokenWalletPlatform.code
        }).send({
            from: owner.address,
            amount: toNano(1)
        });

    logger.log(`TokenWalletPlatform is set`);

    await factoryDirectBuy.methods.setCodeDirectBuy({
            _directBuyCode: DirectBuy.code
        }).send({
            from: owner.address,
            amount: toNano(1)
        });

    logger.log(`DirectBuy is set`);

    return new FactoryDirectBuy(factoryDirectBuy, owner);
};

export const deployFactoryDirectSell = async function(owner: Account, fee: MarketFee, weverVault: Address, weverRoot: Address) {
    const signer = await locklift.keystore.getSigner('0');
    const {contract: factoryDirectSell} = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: "FactoryDirectSell",
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _owner: owner.address,
            sendGasTo: owner.address,
            _fee: fee,
            _weverVault: weverVault,
            _weverRoot: weverRoot
        },
        initParams: {
            nonce_: locklift.utils.getRandomNonce()
        },
        value: locklift.utils.toNano(10)
    }));

    logger.log(`FactoryDirectSell address ${factoryDirectSell.address.toString()}`);

    const DirectSell = locklift.factory.getContractArtifacts("DirectSell");
    await factoryDirectSell.methods.setCodeDirectSell({
            _directSellCode: DirectSell.code,
        }).send({
        from:owner.address,
        amount:toNano(1)
    })

    logger.log(`DirectSell is set`);

    return new FactoryDirectSell(factoryDirectSell, owner);
}
