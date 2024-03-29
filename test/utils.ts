import { FactorySource } from "../build/factorySource";
import {Address, Contract, zeroAddress, WalletTypes, toNano, getRandomNonce} from "locklift";
import { Account } from "everscale-standalone-client/nodejs";
import { Token } from "./wrappers/token";
import { AuctionRoot } from "./wrappers/auction";
import { NftC } from "./wrappers/nft";
import { FactoryDirectBuy } from "./wrappers/directBuy";
import { FactoryDirectSell } from "./wrappers/directSell";

const fs = require('fs')
const logger = require("mocha-logger");
const { expect } = require("chai");

type MarketFee = {
    numerator: string;
    denominator: string;
}

type Royalty = {
    numerator: string;
    denominator: string;
    receiver: Address;
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

export function now() {
    // @ts-ignore
    if (locklift.testing.isEnabled) {
        return locklift.testing.getCurrentTime();
    } else {
        return Date.now()
    }
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

export const deployCollectionAndMintNftWithRoyalty = async function (account: Account, remainOnNft: 1, pathJsonFile: "nft_to_address.json", accForNft: Account[], royalty: Royalty, inNft: boolean = true) {
    let Nft
    if (inNft){
        Nft = (await locklift.factory.getContractArtifacts("NftWithRoyalty"));
    } else {
        Nft = (await locklift.factory.getContractArtifacts("Nft"));
    }

    const Index = (await locklift.factory.getContractArtifacts("Index"));
    const IndexBasis = (await locklift.factory.getContractArtifacts("IndexBasis"));
    const signer = await locklift.keystore.getSigner('0');

    remainOnNft = remainOnNft || 0;
    accForNft = accForNft || "";

    let array_json: any;
    const data = fs.readFileSync(pathJsonFile, 'utf8');
    if (data) array_json = JSON.parse(data);
    let collection;
    if (inNft) {
        const { contract: collectionContract } = await locklift.factory.deployContract({
            contract: "CollectionRoyalty",
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
        collection = collectionContract
    } else {
         const { contract: collectionContract } = await locklift.factory.deployContract({
            contract: "CollectionWithRoyalty",
            publicKey: (signer?.publicKey) as string,
            constructorParams: {
                codeNft: Nft.code,
                codeIndex: Index.code,
                codeIndexBasis: IndexBasis.code,
                owner: account.address,
                remainOnNft: toNano(remainOnNft),
                json: JSON.stringify(array_json.collection),
                royalty: royalty
            },
            initParams: {
                nonce_: locklift.utils.getRandomNonce()
            },
            value: toNano(5)
        });
        collection = collectionContract
    }
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
            if (inNft) {
                const tx = await locklift.transactions.waitFinalized(
                  collection.methods.mintNft({
                      _owner: accForNft[ch].address,
                      _json: payload,
                      _royalty: royalty
                  }).send({
                      from: account.address,
                      amount: toNano(6),
                  })
                );
            } else {
                const tx = await locklift.transactions.waitFinalized(
                  collection.methods.mintNft({
                      _owner: accForNft[ch].address,
                      _json: payload
                  }).send({
                      from: account.address,
                      amount: toNano(6),
                  })
                );
            }
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

export const deployWnativeRoot = async function (token_name: string, token_symbol: string, owner: Account) {

    const keyPair = (await locklift.keystore.getSigner("0"))!;

    // Wrapped EVER token
    // - Deploy wEVER root
    const TokenPlatform = await locklift.factory.getContractArtifacts('TokenWalletPlatform');
    const TokenWallet = await locklift.factory.getContractArtifacts('VaultTokenWallet_V1');

    const {contract: root} = await locklift.factory.deployContract({
        contract: "VaultTokenRoot_V1",
        constructorParams: {},
        value: toNano(15),
        initParams: {
            name_: "Wrapped EVER",
            symbol_: "WEVER",
            decimals_: 9,
            rootOwner_: owner.address,
            deployer_: zeroAddress,
            randomNonce_: getRandomNonce(),
            walletCode_: TokenWallet.code,
            platformCode_: TokenPlatform.code
        },
        publicKey: keyPair.publicKey,
    })

    let vault = root;

    await root.methods
        .grant()
        .send({
            from: owner.address,
            amount: toNano(1),
        });

    await root.methods
        .deployWallet({
            walletOwner: owner.address,
            deployWalletValue: toNano(2),
            answerId: 0,
        })
        .send({
            from: owner.address,
            amount: toNano(5),
        });

    const rootStandard = await locklift.factory.getDeployedContract('TokenRootUpgradeable', root.address);

    return {
        root: new Token(rootStandard, owner),
        vault: vault.address
    };
}

export const deployAuctionRoot = async function (owner: Account, fee: MarketFee, wnativeRoot: Address) {
    const signer = await locklift.keystore.getSigner('0');

    const Nft = (await locklift.factory.getContractArtifacts("Nft"));
    const Auction = (await locklift.factory.getContractArtifacts("Auction"));

    const { contract: factoryAuction, tx } = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: 'FactoryAuction',
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _owner: owner.address,
            _fee: fee,
            _auctionBidDelta: 500,
            _auctionBidDeltaDecimals: 10000,
            _remainingGasTo: owner.address,
            _wnativeRoot: wnativeRoot
        },
        initParams: {
            nonce_: locklift.utils.getRandomNonce(),
        },
        value: toNano(10)
    }));

    logger.log(`Auction Root address ${factoryAuction.address.toString()}`);

    await factoryAuction.methods.setCodeOffer({
        _newCode: Auction.code
    }).send({
        from: owner.address,
        amount: toNano(1)
    });

    logger.log(`DirectBuy is set`);

    return new AuctionRoot(factoryAuction, owner);
}

export const deployFactoryDirectBuy = async function (owner: Account, fee: MarketFee, wnativeRoot: Address) {
    const signer = await locklift.keystore.getSigner('0');
    const {contract: factoryDirectBuy} = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: "FactoryDirectBuy",
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _owner: owner.address,
            _remainingGasTo: owner.address,
            _fee: fee,
            _wnativeRoot: wnativeRoot
        },
        initParams: {
            nonce_: getRandomNonce()
        },
        value: toNano(10)
    }));

    logger.log(`FactoryDirectBuy address ${factoryDirectBuy.address.toString()}`);

    const TokenWalletPlatform = await locklift.factory.getContractArtifacts('TokenWalletPlatform');
    const DirectBuy = await locklift.factory.getContractArtifacts('DirectBuy');
    // await factoryDirectBuy.methods.setCodeTokenPlatform({
    //         _tokenPlatformCode: TokenWalletPlatform.code
    //     }).send({
    //         from: owner.address,
    //         amount: toNano(1)
    //     });

    // logger.log(`TokenWalletPlatform is set`);

    await factoryDirectBuy.methods.setCodeOffer({
            _newCode: DirectBuy.code
        }).send({
            from: owner.address,
            amount: toNano(1)
        });

    logger.log(`DirectBuy is set`);

    return new FactoryDirectBuy(factoryDirectBuy, owner);
};

export const deployFactoryDirectSell = async function(owner: Account, fee: MarketFee, wnativeRoot: Address) {
    const signer = await locklift.keystore.getSigner('0');
    const {contract: factoryDirectSell} = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: "FactoryDirectSell",
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _owner: owner.address,
            _remainingGasTo: owner.address,
            _fee: fee,
            _wnativeRoot: wnativeRoot
        },
        initParams: {
            nonce_: locklift.utils.getRandomNonce()
        },
        value: locklift.utils.toNano(10)
    }));

    logger.log(`FactoryDirectSell address ${factoryDirectSell.address.toString()}`);

    const DirectSell = locklift.factory.getContractArtifacts("DirectSell");
    await factoryDirectSell.methods.setCodeOffer({
            _newCode: DirectSell.code,
        }).send({
        from:owner.address,
        amount:toNano(1)
    })

    logger.log(`DirectSell is set`);

    return new FactoryDirectSell(factoryDirectSell, owner);
}

export async function tryIncreaseTime(seconds: number) {
    // @ts-ignore
    if (locklift.testing.isEnabled) {
        await locklift.testing.increaseTime(seconds);
    } else {
        await sleep(seconds * 1000);
    }
}
