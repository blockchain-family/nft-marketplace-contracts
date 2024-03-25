import { CallbackType, isValidEverAddress } from "../test/utils";
import { Migration } from "./migration";
import { Contract, toNano, zeroAddress } from "locklift";
import { Address } from "everscale-inpage-provider";
import { FactoryDirectSell } from "../test/wrappers/directSell";
import { CollectionRoyaltyAbi } from "../build/factorySource";
const fs = require('fs')

const migration = new Migration();
const BigNumber = require("bignumber.js");
const prompts = require("prompts");
const logger = require("mocha-logger");

const PAYMENT_TOKEN = '0:1fd59df9c396130d81a14dad6df5272b9cd073d06516b2f97dd360e13866e589';
const RECIPIENT = '0:fa9cf723c88796f269eb3d75e10e3035cce8f99840b137f320bd19e9e304a5c7'; //owner nft
const FACTORY_DIRECT_SELL = '0:2c7a0452a76a717b226807a36f0e42387d92bae3949da4c6716f66e33558ab96';
const START_TIME = 1710333200; //in sec
const PRICE = 0.000001;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitOfferCreated(collection: Address, nftId: number) {
  const collectionRoyalty: Contract<CollectionRoyaltyAbi> = await locklift.factory.getDeployedContract(
    "CollectionRoyalty",
    collection,
  );
  let { nft: nftAddress } = await collectionRoyalty.methods.nftAddress({ answerId: 0, id: nftId }).call();
  const Nft = await locklift.factory.getDeployedContract("NftWithRoyalty", nftAddress);
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

async function main() {
  const signer = await locklift.keystore.getSigner("0");
  const account = await migration.loadAccount("Account1");

  const savedCollection = await migration.loadContract("CollectionRoyalty", "CollectionRoyalty");

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
  ]);

  const collection = (await locklift.factory.getDeployedContract(
      'CollectionRoyalty',
      new Address(response.collection.toString()))
  );

  console.log('CollectionRoyalty', response.collection.toString());

  const factoryDirectSell = await locklift.factory.getDeployedContract(
    "FactoryDirectSell",
    new Address(FACTORY_DIRECT_SELL.toString()),
  );

  const gas = (await factoryDirectSell.methods.getGasValue().call()).value0;
  const gasPrice = new BigNumber(1).shiftedBy(9).div(gas.gasK);
  let targetGas = new BigNumber(gas.sell.dynamicGas).times(gasPrice).plus(gas.sell.fixedValue).toNumber();
  let gasChangeManager = new BigNumber(targetGas).plus(500000000).toString();


  // build payload for directSell
  logger.log("Build payload");
  const targetPayload = (
    await factoryDirectSell.methods
      .buildDirectSellCreationPayload({
        _callbackId: 0,
        _startTime: START_TIME,
        _durationTime: 0,
        _paymentToken: new Address(PAYMENT_TOKEN.toString()),
        _price: toNano(PRICE),
        _recipient: new Address(RECIPIENT.toString()),
        _discountCollection: null,
        _discountNftId: null,
      })
      .call()
  ).value0;

  const totalMinted = await collection.methods.totalMinted({answerId: 0}).call();
  const lastNFT = Number(totalMinted.count);
  console.log(lastNFT);

   // const balanceStart = await locklift.provider.getBalance(account.address);
   // const requiredGas = new BigNumber(gasChangeManager).times(lastNFT).plus(1).shiftedBy(9);
   // if (requiredGas.gt(balanceStart)) {
   //   throw Error('NOT ENOUGH BALANCE ON ' + account.address + '. REQUIRES: ' + requiredGas.shiftedBy(-9).toString() + ' EVER')
   // }

    for (let i = 0; i < lastNFT; i++) {

      let { nft: nftAddress } = await collection.methods.nftAddress({ answerId: 0, id: i }).call();
      const Nft = await locklift.factory.getDeployedContract("NftWithRoyalty", nftAddress);
      const nftInfo = await Nft.methods.getInfo({answerId: 0}).call();

      if (nftInfo.owner.toString() == nftInfo.manager.toString() && nftInfo.owner.toString() == account.address.toString()) {

          console.log('Start sell for nftId:', i);

          let callback: CallbackType;
          callback = [
            factoryDirectSell.address,
            {
              value: targetGas,
              payload: targetPayload,
            },
          ];
          const callbacks: CallbackType[] = [];
          callbacks.push(callback);

          console.log("account balance", await locklift.provider.getBalance(account.address));

          (Nft.methods.changeManager({
            newManager: factoryDirectSell.address,
            sendGasTo: account.address,
            callbacks: callbacks
          }).send({
            from: account.address,
            amount: gasChangeManager
          }));
    // (await locklift.tracing.trace(
          // .traceTree?.beautyPrint()

          await waitOfferCreated(collection.address, i);
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

  console.log("account balance", await locklift.provider.getBalance(account.address));
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
