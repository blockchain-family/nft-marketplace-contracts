import { isValidEverAddress} from "../test/utils";
import { Migration } from "./migration";
import {Contract, toNano} from "locklift";
import {Address} from "everscale-inpage-provider";
import {FactoryDirectSell} from "../test/wrappers/DirectSell";
import {CollectionSimilarAbi} from "../build/factorySource";

const migration = new Migration();
const BigNumber = require('bignumber.js');
const fs = require('fs');
const prompts = require('prompts');
const logger = require("mocha-logger");
const request = require('request');

const STEP = 2000;
const FACTORY_DIRECT_SELL = new Address('0:d1f0569cb203e11a701b2e8bba65c3c79635367ce12c2ee563cf3281c72841e6');
const COLLECTIONS_DATA = [{
    name: 'Aquatech',
    collection: new Address('0:7eb6488246ba08f88fe8779e9257ca9ebc7d2f82f6111ce6747abda368e3c7a8'),
    mintAndSell: new Address('0:47f392241234f101b9081747739ce465b99bfa4da24c80932dbdb918dcaf3506')
},{
    name: 'Peachy Sands',
    collection: new Address('0:33a630f9c54fc4092f43ab978f3fd65964bb0d775553c16953aa1568eb63ab0f'),
    mintAndSell: new Address('0:0e174bf4871c10d3be4f1507b2125518de1f68af036cd9ce350a0fc108624d6e')
},{
    name: 'The Bubblemotes',
    collection: new Address('0:d62691c79f447f512d7ad235a291435a8a886debff1b72dfc3ff5e486798d96e'),
    mintAndSell: new Address('0:a3efca5e3d472928107a9459d7a40dd1d3b42a4881de9f751eb1e917362e401e')
},{
    name: 'Absrart Collection',
    collection: new Address('0:ec0ab798c85aa7256865221bacd4f3df220cf60277a2b79b3091b76c265d1cd7'),
    mintAndSell: new Address('0:f9a92fdb7a38f1f54c3b962d900cbf0057c83da4462fe8149f2cb76e8c7f0caa')
}];

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitOfferCreated(collection: Address, nftId: number) {
    const collectionSimilar: Contract<CollectionSimilarAbi> = await locklift.factory.getDeployedContract(
        "CollectionSimilar",
        collection
    );
    let {nft: nftAddress} = (await collectionSimilar.methods.nftAddress({answerId: 0, id: nftId}).call());
    const Nft = await locklift.factory.getDeployedContract("Nft", nftAddress);
    let manager = (await Nft.methods.getInfo({answerId: 0}).call()).manager.toString();
    let owner = (await Nft.methods.getInfo({answerId: 0}).call()).owner.toString();

    if (owner == manager) {
        console.log(`Nft(${nftAddress}) not on sale.`);
        await sleep(30000);
        await waitOfferCreated(collection, nftId);
    } else {
        console.log(`Nft(${nftAddress}) ON SALE. DirectSell/DirectSellFactory = ${manager}`);
    }
}

async function isNftDeployed(collection: Address, nftId: number) {
    const collectionSimilar: Contract<CollectionSimilarAbi> = await locklift.factory.getDeployedContract(
        "CollectionSimilar",
        collection
    );
    let {nft: nftAddress} = (await collectionSimilar.methods.nftAddress({answerId: 0, id: nftId}).call());

    const isDeployed = (await locklift.provider.getFullContractState({address: nftAddress})).state?.isDeployed;
    if(isDeployed) {
        console.log(`NFT(${nftAddress}) DEPLOYED`);
    } else {
        console.log(`NFT(${nftAddress}) not deployed`);
    }
    return isDeployed;
}

async function waitNftMinted(collection: Address, nftId: number) {
    const lastId = await getLastNftId(collection);
    const nftDeployed = await isNftDeployed(collection, nftId);

    if (lastId < nftId || !nftDeployed) {
        console.log(`Last event nft id: ${lastId}/${nftId}`);
        await sleep(30000);
        await waitNftMinted(collection, nftId);
    } else {
        console.log(`All minted`);
    }

}

async function getLastNftId(collection: Address) {
        const collectionSimilar: Contract<CollectionSimilarAbi> = await locklift.factory.getDeployedContract(
            "CollectionSimilar",
            collection
        )
        const lastNFTCreated = ((await collectionSimilar.getPastEvents<'NftCreated'>({
            limit: 1,
            filter: (event) => event.event === 'NftCreated'
        })).events).shift();
        return parseInt(lastNFTCreated!.data.id);
}

async function main() {
    const signer = (await locklift.keystore.getSigner('0'));
    const account = await migration.loadAccount('Account1');

        const response = await prompts([
        {
            type: 'number',
            name: 'from',
            message: 'Get NFT from count (default 1)',
            initial: 1
        },
        {
            type: 'number',
            name: 'to',
            message: 'Get NFT to count (default 10)',
            initial: 10
        }
    ]);

    let current = response.from;

    while(current < response.to ) {
        const to = Math.min(current + STEP, response.to);

        for( let i = 0; i < COLLECTIONS_DATA.length; i++ ) {
            const data = COLLECTIONS_DATA[i];

            const lastNFTCreated = await getLastNftId(data.collection);

            if (lastNFTCreated < to) {

                const mintAndSell = await locklift.factory.getDeployedContract(
                    "MintAndSell",
                    data.mintAndSell
                );

                const from: number = Math.max(lastNFTCreated, current) + 1;

                console.log(`Start Mint NFT for collection ${data.name} - ${data.collection.toString()}.MintAndSell - ${data.mintAndSell}. from = ${from}, to = ${to}`);
                await mintAndSell.methods.createItems({_fromId: from, _toId: to}).send({
                    from: account.address,
                    amount: new BigNumber(to).minus(from).plus(1).times(1.2).plus(1).shiftedBy(9).toString()
                });

                await waitNftMinted(data.collection, to);
                console.log(`All NFT minted for collection ${data.name} - ${data.collection.toString()}. from = ${from}, to = ${to}`);

                console.log(`Update metadata`);
                let options = {
                  'method': 'POST',
                  'url': 'https://indexer-venom.bf.works/metadata/refresh/',
                  'headers': {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    "collection": data.collection.toString()
                  })

                };
                request(options, function (error: any, response: any) {
                  if (error) throw new Error(error);
                  console.log(response.body);
                });

                console.log(`Start sell minted NFTs for collection ${data.name} - ${data.collection.toString()}. from = ${from}, to = ${to}`);
                const factoryDirectSell = await locklift.factory.getDeployedContract(
                    "FactoryDirectSell",
                    FACTORY_DIRECT_SELL
                );
                const gas = (await factoryDirectSell.methods.getGasValue().call()).value0;
                const gasPrice = new BigNumber(1).shiftedBy(9).div(gas.gasK);
                let targetGas = new BigNumber(gas.sell.dynamicGas).times(gasPrice).plus(gas.sell.fixedValue).toNumber();

                console.log(`MintAndSell('${mintAndSell.address}').sellItems({_fromId: ${from}, _toId: ${to}})`);
                let transaction  = await mintAndSell.methods.sellItems({_fromId: from, _toId: to}).send({
                    from: account.address,
                    amount: new BigNumber(targetGas).shiftedBy(-9).plus(0.4).times(to - from + 1)
                        .plus(1)
                        .shiftedBy(9).toString()
                });
                console.log(`tx: ${transaction.id.hash}`);

                console.log('Start check offer created');
                await waitOfferCreated(data.collection, to);
                console.log(`All NFTs was sell for collection ${data.name} - ${data.collection.toString()}. from = ${from}, to = ${to}`);

                console.log(`Drain gas for MintAndSell - ${mintAndSell.address}`);
                await mintAndSell.methods.drainGas({}).send({
                    from: account.address,
                    amount: toNano(0.1)
                });
            }

        }
        current = to;
    }

}

main()
.then(() => process.exit(0))
.catch(e => {
    console.log(e);
    process.exit(1);
});