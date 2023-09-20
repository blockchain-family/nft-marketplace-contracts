import { isValidEverAddress } from "../test/utils";
import { Migration } from "./migration";
import { Contract, toNano } from "locklift";
import { Address } from "everscale-inpage-provider";
import { FactoryDirectSell } from "../test/wrappers/directSell";
import { CollectionSimilarAbi } from "../build/factorySource";

const migration = new Migration();
const BigNumber = require("bignumber.js");
const fs = require("fs");
const prompts = require("prompts");
const logger = require("mocha-logger");
const request = require("request");

const STEP = 2000;
//const FACTORY_DIRECT_SELL = new Address("0:3158c265c052f093b0d9bd799b74dbc454ee35a79501bd599254997bc5e92b73");
const loadDirectSell = migration.loadContract("FactoryDirectSell", "FactoryDirectSell");
const FACTORY_DIRECT_SELL = loadDirectSell.address;
// const collection = {
//   name: "DiscoDance",
//   collection: new Address("0:dc7523fa70eb5d83cb70b366b8e0d8bdf9cf4a8a9a2fdab00a9bcf9420874be4"),
//   mintAndSell: new Address("0:99c7432fc154bb5bfc04ac65c2f7a92bfa66dec9f673302124784e5174ae9b78"),
// };
const loadCollection = migration.loadContract("CollectionSimilar", "SimilarCollection");
const loadMintAndSell = migration.loadContract("MintAndSell", "MintAndSell");
const collection = {
  name: "DiscoDance",
  collection: loadCollection.address,
  mintAndSell: loadMintAndSell.address,
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitOfferCreated(collection: Address, nftId: number) {
  const collectionSimilar: Contract<CollectionSimilarAbi> = await locklift.factory.getDeployedContract(
    "CollectionSimilar",
    collection,
  );
  let { nft: nftAddress } = await collectionSimilar.methods.nftAddress({ answerId: 0, id: nftId }).call();
  const Nft = await locklift.factory.getDeployedContract("Nft", nftAddress);
  let manager = (await Nft.methods.getInfo({ answerId: 0 }).call()).manager.toString();
  let owner = (await Nft.methods.getInfo({ answerId: 0 }).call()).owner.toString();

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
    collection,
  );
  let { nft: nftAddress } = await collectionSimilar.methods.nftAddress({ answerId: 0, id: nftId }).call();
  const isDeployed = (await locklift.provider.getFullContractState({ address: nftAddress })).state?.isDeployed;
  if (isDeployed) {
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
    collection,
  );
  const lastNFTCreated = (
    await collectionSimilar.getPastEvents<"NftCreated">({
      limit: 1,
      filter: event => event.event === "NftCreated",
    })
  ).events.shift();
  return lastNFTCreated?.data?.id ? parseInt(lastNFTCreated?.data?.id) : 0;
}

async function main() {
  const signer = await locklift.keystore.getSigner("0");
  const account = await migration.loadAccount("Account1");

  const response = await prompts([
    {
      type: "number",
      name: "from",
      message: "Get NFT from count (default 1)",
      initial: 1,
    },
    {
      type: "number",
      name: "to",
      message: "Get NFT to count (default 10)",
      initial: 10,
    },
  ]);

  let current = response.from;

  while (current < response.to) {
    const to = Math.min(current + STEP, response.to);

    const lastNFTCreated = await getLastNftId(collection.collection);

    if (lastNFTCreated < to) {
      const mintAndSell = await locklift.factory.getDeployedContract("MintAndSell", collection.mintAndSell);

      const from: number = Math.max(lastNFTCreated, current) + 1;

      console.log(
        `Start Mint NFT for collection 
        ${collection.name} - ${collection.collection.toString()}. 
        MintAndSell - ${collection.mintAndSell}. 
        from = ${from}, to = ${to}`,
      );
      await mintAndSell.methods.createItems({ _fromId: from, _toId: to }).send({
        from: account.address,
        amount: new BigNumber(to).minus(from).plus(1).times(1.2).plus(6).shiftedBy(9).toString(),
      });
      await waitNftMinted(collection.collection, to);
      console.log(
        `All NFT minted for collection ${
          collection.name
        } - ${collection.collection.toString()}. from = ${from}, to = ${to}`,
      );

      console.log(`Update metadata`);
      let options = {
        method: "POST",
        url: "https://indexer-venom.bf.works/metadata/refresh/",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          collection: collection.collection.toString(),
        }),
      };
      request(options, function (error: any, response: any) {
        if (error) throw new Error(error);
        console.log(response.body);
      });

      console.log(
        `Start sell minted NFTs for collection ${
          collection.name
        } - ${collection.collection.toString()}. from = ${from}, to = ${to}`,
      );
      const factoryDirectSell = await locklift.factory.getDeployedContract("FactoryDirectSell", FACTORY_DIRECT_SELL);
      const gas = (await factoryDirectSell.methods.getGasValue().call()).value0;
      const gasPrice = new BigNumber(1).shiftedBy(9).div(gas.gasK);
      let targetGas = new BigNumber(gas.sell.dynamicGas).times(gasPrice).plus(gas.sell.fixedValue).toNumber();

      console.log(`MintAndSell('${mintAndSell.address}').sellItems({_fromId: ${from}, _toId: ${to}})`);
      let transaction = await mintAndSell.methods.sellItems({ _fromId: from, _toId: to }).send({
        from: account.address,
        amount: new BigNumber(targetGas)
          .shiftedBy(-9)
          .plus(0.4)
          .times(to - from + 1)
          .plus(1)
          .shiftedBy(9)
          .toString(),
      });
      console.log(`tx: ${transaction.id.hash}`);

      console.log("Start check offer created");
      await waitOfferCreated(collection.collection, to);
      console.log(
        `All NFTs was sell for collection ${
          collection.name
        } - ${collection.collection.toString()}. from = ${from}, to = ${to}`,
      );

      console.log(`Drain gas for MintAndSell - ${mintAndSell.address}`);
      await mintAndSell.methods.drainGas({}).send({
        from: account.address,
        amount: toNano(0.1),
      });
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
