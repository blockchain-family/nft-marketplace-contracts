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

// const FACTORY_AUCTION = '0:a9408caeabb9a443ebca91c7f7d23c0f285f5734ae8ee1ce60dc0de1341aa58e';
const FACTORY_AUCTION = '0:07731ec88ff1ab5343116786a471b10ae87eb06b50c48e657d0ca7eb8bbcc39f';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitOfferCanceled(collection_: Address, nftId: number) {
  const collection: Contract<CollectionAbi> = await locklift.factory.getDeployedContract(
    "Collection",
    collection_,
  );
  let { nft: nftAddress } = await collection.methods.nftAddress({ answerId: 0, id: nftId }).call();
  const Nft = await locklift.factory.getDeployedContract("Nft", nftAddress);
  let manager = (await Nft.methods.getInfo({ answerId: 0 }).call()).manager.toString();
  let owner = (await Nft.methods.getInfo({ answerId: 0 }).call()).owner.toString();

  if (owner == manager) {
    console.log(`Auction for Nft(${nftAddress}) not finshed.`);
    await sleep(30000);
    await waitOfferCanceled(collection.address, nftId);
  } else {
    console.log(`Auction for Nft(${nftAddress}) FINISHED`);
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
    }
  ]);

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
  let targetGas = new BigNumber(gas.cancel.dynamicGas).times(gasPrice).plus(gas.cancel.fixedValue).toNumber();
  let gasFinish = new BigNumber(targetGas).plus(200000000).toString();

  const totalMinted = await collection.methods.totalMinted({answerId: 0}).call();
  const count = Number(totalMinted.count);

  const balanceStart = await locklift.provider.getBalance(account.address);
  const requiredGas = new BigNumber(gasFinish).times(count).plus(1);

  console.log("account balance", new BigNumber(balanceStart).shiftedBy(-9).toString());
  console.log('requiredGas', requiredGas.shiftedBy(-9).toString());

  if (requiredGas.gt(balanceStart)) {
    throw Error('NOT ENOUGH BALANCE ON ' + account.address + '. REQUIRES: ' + requiredGas.shiftedBy(-9).toString() + ' EVER')
  }

  for (let i = 0; i < count; i++) {

    let { nft: nftAddress } = await collection.methods.nftAddress({ answerId: 0, id: i }).call();
    const isDeployed = (await locklift.provider.getFullContractState({ address: nftAddress })).state?.isDeployed;

    if (isDeployed) {
      const Nft = await locklift.factory.getDeployedContract("Nft", nftAddress);
      const nftInfo = await Nft.methods.getInfo({answerId: 0}).call();

      const auction = await locklift.factory.getDeployedContract("Auction", nftInfo.manager);
      let offerType = 'Unknown';
      await (auction.methods.getTypeContract({}).call().then(e => offerType = e.value0).catch(e => {}));

      if (
          offerType == 'Auction'
      ) {
        console.log('Cancel auction for nftId:', i);

        auction.methods.finishOffer({
          _callbackId: 0,
          _remainingGasTo: account.address
        }).send({
          from: account.address,
          amount: gasFinish
        });

        await waitOfferCanceled(collection.address, i);
      } else {
        console.log(`NFT(${nftAddress}) was not Auction`);
      }
    } else {
      console.log(` NFT(${nftAddress}) not deployed ${i}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
