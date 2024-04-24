import { CallbackType, isValidEverAddress } from "../test/utils";
import { Migration } from "./migration";
import { Contract, toNano, zeroAddress } from "locklift";
import { Address } from "everscale-inpage-provider";
import { FactoryDirectSell } from "../test/wrappers/directSell";
import {CollectionAbi, CollectionRoyaltyAbi, CollectionSimilarAbi} from "../build/factorySource";
const fs = require('fs')

const migration = new Migration();
const BigNumber = require("bignumber.js");
const prompts = require("prompts");
const logger = require("mocha-logger");

const PAYMENT_TOKEN = '0:77d36848bb159fa485628bc38dc37eadb74befa514395e09910f601b841f749e';
// const FACTORY_AUCTION = '0:a9408caeabb9a443ebca91c7f7d23c0f285f5734ae8ee1ce60dc0de1341aa58e';
const FACTORY_AUCTION = '0:2b5c3c032595d94aa9d0cf5c604819c0426f03db9d6dd50eee110aabe3feae7d';
const START_TIME = 1710333200; //in sec
const DURAION_TIME = 86400; //one day
const PRICE = 0.000001;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitOfferCreated(collection_: Address, nftId: number) {
  const collection: Contract<CollectionAbi> = await locklift.factory.getDeployedContract(
    "Collection",
    collection_,
  );
  let { nft: nftAddress } = await collection.methods.nftAddress({ answerId: 0, id: nftId }).call();
  const Nft = await locklift.factory.getDeployedContract("Nft", nftAddress);
  let manager = (await Nft.methods.getInfo({ answerId: 0 }).call()).manager.toString();
  let owner = (await Nft.methods.getInfo({ answerId: 0 }).call()).owner.toString();

  if (owner == manager) {
    console.log(`Nft(${nftAddress}) not on auction.`);
    await sleep(30000);
    await waitOfferCreated(collection.address, nftId);
  } else {
    console.log(`Nft(${nftAddress}) ON AUCTION. AUCTION = ${manager}`);
  }
}

async function main() {
  const signer = await locklift.keystore.getSigner("0");
  const account = await migration.loadAccount("Account1");

  const savedCollection = await migration.loadContract("Collection", "Collection");

  const response = await prompts([
    {
      type: "text",
      name: "collection",
      message: "Get Collection Address (default " + savedCollection.address + ")",
      validate: (value: any) =>
        isValidEverAddress(value) || value === ""
          ? true
          : "Invalid Everscale address",
        initial: savedCollection.address
    },
    {
      type: "number",
      name: "from",
      message: "Get NFT from count (default 0)",
      initial: 0,
    },
    {
      type: "number",
      name: "to",
      message: "Get NFT to count (default 10)",
      initial: 10,
    },
  ]);

  if (response.to < response.from) {
    throw Error(`to - ${response.to} have to more then from - ${response.from}`);
  }

  const collection = (await locklift.factory.getDeployedContract(
      'Collection',
      new Address(response.collection.toString()))
  );

  console.log('Collection', response.collection.toString());

  const factoryAuction = await locklift.factory.getDeployedContract(
    "FactoryAuction",
    new Address(FACTORY_AUCTION.toString()),
  );

  const gas = (await factoryAuction.methods.getGasValue().call()).value0;
  const gasPrice = new BigNumber(1).shiftedBy(9).div(gas.gasK);
  let targetGas = new BigNumber(gas.start.dynamicGas).times(gasPrice).plus(gas.start.fixedValue).toNumber();
  let gasChangeManager = new BigNumber(targetGas).plus(200000000).toString();

  // build payload for auction
  logger.log("Build payload");
  const targetPayload = (
    await factoryAuction.methods
      .buildAuctionCreationPayload({
        answerId: 0,
        _callbackId: 0,
        _paymentToken: new Address(PAYMENT_TOKEN.toString()),
        _price: toNano(PRICE),
        _auctionStartTime: START_TIME,
        _auctionDuration: DURAION_TIME,
        _discountCollection: null,
        _discountNftId: null,
      })
      .call()
  ).value0;

  const totalMinted = await collection.methods.totalMinted({answerId: 0}).call();
  const lastNFT = Number(totalMinted.count);

  const to = lastNFT < response.to ? lastNFT : response.to;
  const from = response.from == 1 ? 0 : response.from;

  const count = to - from;
  console.log(count);

  const balanceStart = await locklift.provider.getBalance(account.address);
  const requiredGas = new BigNumber(gasChangeManager).times(count).plus(1);

  console.log("account balance", new BigNumber(balanceStart).shiftedBy(-9).toString());
  console.log('requiredGas', requiredGas.shiftedBy(-9).toString());

  if (requiredGas.gt(balanceStart)) {
    throw Error('NOT ENOUGH BALANCE ON ' + account.address + '. REQUIRES: ' + requiredGas.shiftedBy(-9).toString() + ' EVER')
  }

  for (let i = from; i < to; i++) {

    let { nft: nftAddress } = await collection.methods.nftAddress({ answerId: 0, id: i }).call();
    const Nft = await locklift.factory.getDeployedContract("Nft", nftAddress);
    const nftInfo = await Nft.methods.getInfo({answerId: 0}).call();

    const isDeployed = (await locklift.provider.getFullContractState({ address: nftAddress })).state?.isDeployed;
    if (
      isDeployed &&
      nftInfo.owner.toString() == nftInfo.manager.toString() &&
      nftInfo.owner.toString() == account.address.toString()
    ) {

      console.log('Start auction for nftId:', i);

      let callback: CallbackType;
      callback = [
         factoryAuction.address,
           {
              value: targetGas,
              payload: targetPayload,
           },
         ];
      const callbacks: CallbackType[] = [];
      callbacks.push(callback);

      Nft.methods.changeManager({
        newManager: factoryAuction.address,
        sendGasTo: account.address,
        callbacks: callbacks
      }).send({
        from: account.address,
        amount: gasChangeManager
      });

      await waitOfferCreated(collection.address, i);
    } else {
      console.log(`Can't start auction for NFT(${nftAddress})`);
    }
  }

  const response3 = await prompts([
    {
      type: "text",
      name: "owner",
      message: "Get Collection Owner Address (default " + account.address + ")",
      validate: (value: any) =>
        isValidEverAddress(value) || value === ""
          ? true
          : "Invalid Everscale address",
    },
  ]);

  if (response3.owner) {
    console.log(response3.owner);
    console.log(`Transfer ownership for collection`);
    await collection.methods
      .transferOwnership({
        newOwner: response3.owner,
      })
      .send({
        from: account.address,
        amount: locklift.utils.toNano(1),
      });
  }
  console.log("account balance", await locklift.provider.getBalance(account.address));
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
