import { Account } from "locklift/build/factory";
import { FactorySource } from "../build/factorySource";
import { Address, Contract, zeroAddress } from "locklift";
import { Token } from "./wrappers/token";
import { AuctionRoot } from "./wrappers/auction";
import { NftC } from "./wrappers/nft";
//@ts-ignore
import { FactoryDirectBuy } from "./wrappers/directbuy";
//@ts-ignore
import { FactoryDirectSell } from "./wrappers/directsell";

const fs = require('fs')
const logger = require("mocha-logger");
const { expect } = require("chai");

export type AddressN = `0:${string}`
export const isValidEverAddress = (address: string): address is AddressN => /^(?:-1|0):[0-9a-fA-F]{64}$/.test(address);
export declare type AccountType = Account<FactorySource["Wallet"]>;
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
    const signer = await locklift.keystore.getSigner('0');
    let accountsFactory = locklift.factory.getAccountsFactory('Wallet');

    const { account: wallet } = await locklift.tracing.trace(accountsFactory.deployNewAccount({
        publicKey: (signer?.publicKey) as string,
        value: locklift.utils.toNano(initial_balance).toString(),
        initParams: {
            _randomNonce: locklift.utils.getRandomNonce(),
        },
        constructorParams: {}
    }));

    const walletBalance = await locklift.provider.getBalance(wallet.address);
    expect(Number(walletBalance)).to.be.above(0, 'Bad user balance');

    logger.log(`User address: ${wallet.address.toString()}`);

    return wallet;
}

export const deployCollectionAndMintNft = async function (account: AccountType, remainOnNft: 1, pathJsonFile: "nft_to_address.json", accForNft: AccountType[]) {
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
            remainOnNft: locklift.utils.toNano(remainOnNft),
            json: JSON.stringify(array_json.collection)
        },
        initParams: {
            nonce_: locklift.utils.getRandomNonce()
        },
        value: locklift.utils.toNano(5)
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
                "external_url": "https://flatqube.io/"
            }
            let payload = JSON.stringify(item)
            let accountFactory = await locklift.factory.getAccountsFactory('Wallet');
            const acc = accountFactory.getAccount(account.address, (signer?.publicKey) as string);
            await acc.runTarget({
                contract: collection,
                value: locklift.utils.toNano(6),
            },
            (collNFT) => collNFT.methods.mintNft({
                _owner: accForNft[ch].address,
                _json: payload,
            }));
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
export const deployNFT = async function (account: AccountType, collection: CollectionType, nft_name: string, nft_description: string, nft_url: string, externalUrl: string, ownerNFT = account) {
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

    await locklift.tracing.trace(account.runTarget(
        {
            contract: collectionNFT,
            value: locklift.utils.toNano(10)
        },
        (nft) => nft.methods.mintNft({
            _owner: ownerNFT.address,
            _json: payload

        }),
    ));

    let totalMinted = await collectionNFT.methods.totalMinted({ answerId: 0 }).call();
    let nftAddress = await collectionNFT.methods.nftAddress({ answerId: 0, id: (Number(totalMinted.count) - 1).toFixed() }).call();
    return NftC.from_addr(nftAddress.nft, ownerNFT);
}

export const deployTokenRoot = async function (token_name: string, token_symbol: string, owner: AccountType) {
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
            deployer_: new Address(zeroAddress),
            platformCode_: TokenWalletPlatform.code
        },
        publicKey: signer?.publicKey as string,
        constructorParams: {
            initialSupplyTo: new Address(zeroAddress),
            initialSupply: 0,
            deployWalletValue: 0,
            mintDisabled: false,
            burnByRootDisabled: false,
            burnPaused: false,
            remainingGasTo: owner.address
        },
        value: locklift.utils.toNano(2)
    }));

    logger.log(`Token root address: ${_root.address.toString()}`);

    expect(Number(await locklift.provider.getBalance(_root.address))).to.be.above(0, 'Root balance empty');
    return new Token(_root, owner);
}

export const deployAuctionRoot = async function (owner: AccountType) {
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
            _marketFee: 0,
            _marketFeeDecimals: 0,
            _auctionBidDelta: 500,
            _auctionBidDeltaDecimals: 10000,
            _sendGasTo: owner.address

        },
        initParams: {
            nonce_: locklift.utils.getRandomNonce(),
        },
        value: locklift.utils.toNano(10)
    }));

    logger.log(`Auction Root address ${auctionRootTip3.address.toString()}`);

    return new AuctionRoot(auctionRootTip3, owner);
}

export const deployFactoryDirectBuy = async function (owner: AccountType) {
    const signer = await locklift.keystore.getSigner('0');
    const {contract: factoryDirectBuy} = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: "FactoryDirectBuy",
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _owner: owner.address,
            sendGasTo: owner.address
        },
        initParams: {
            nonce_: locklift.utils.getRandomNonce()    
        },
        value: locklift.utils.toNano(10)
    }));

    logger.log(`FactoryDirectBuy address ${factoryDirectBuy.address.toString()}`);
    
    const TokenWalletPlatform = await locklift.factory.getContractArtifacts('TokenWalletPlatform');
    const DirectBuy = await locklift.factory.getContractArtifacts('DirectBuy');
    await owner.runTarget(
        {
            contract: factoryDirectBuy,
            value: locklift.utils.toNano(1),
        },
        (twP) => twP.methods.setCodeTokenPlatform({
            _tokenPlatformCode: TokenWalletPlatform.code
        }),
    );

    logger.log(`TokenWalletPlatform is set`);

    await owner.runTarget(
        {
          contract: factoryDirectBuy,
          value: locklift.utils.toNano(1),  
        },
        (dB) => dB.methods.setCodeDirectBuy({
            _directBuyCode: DirectBuy.code
        }),
    );

    logger.log(`DirectBuy is set`);

    return new FactoryDirectBuy(factoryDirectBuy, owner);
};    

export const deployFactoryDirectSell = async function(owner: AccountType) {
    const signer = await locklift.keystore.getSigner('0');
    const {contract: factoryDirectSell} = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: "FactoryDirectSell",
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _owner: owner.address,
            sendGasTo: owner.address
        },
        initParams: {
            nonce_: locklift.utils.getRandomNonce()    
        },
        value: locklift.utils.toNano(10)
    }));

    logger.log(`FactoryDirectSell address ${factoryDirectSell.address.toString()}`);

    const DirectSell = locklift.factory.getContractArtifacts("DirectSell");
    await owner.runTarget(
        {
            contract:factoryDirectSell,
            value: locklift.utils.toNano(1),
        },
        (dS) => dS.methods.setCodeDirectSell({
            _directSellCode: DirectSell.code,
        }),
    );

    logger.log(`DirectSell is set`);

    return new FactoryDirectSell(factoryDirectSell, owner);  
}