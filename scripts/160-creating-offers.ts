import { CallbackType, isValidEverAddress } from "../test/utils";
import { Migration } from "./migration";
import { Contract, toNano, zeroAddress } from "locklift";
import { Address } from "everscale-inpage-provider";
import { FactoryDirectBuy } from "../test/wrappers/directBuy";
import { FactoryDirectBuyAbi} from "../build/factorySource";
import {TokenWallet} from "../test/wrappers/token_wallet";
const fs = require('fs')

const migration = new Migration();
const BigNumber = require("bignumber.js");
const prompts = require("prompts");
const logger = require("mocha-logger");

let nfts: any;

const PAYMENT_TOKEN = '0:77d36848bb159fa485628bc38dc37eadb74befa514395e09910f601b841f749e';
const FACTORY_DIRECT_BUY = '0:c84e79f94f1dd7b68faa7920763d3d783a2a03e7acd33d43b17fa94d041c3d43';
const START_TIME = 1710333200; //in sec


function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitOfferCreated(nftAddress: Address) {

  const event = await getLastOffer();
  const isDeployed = event?.nft ? event?.nft.toString() == nftAddress.toString() : false;

  if (!isDeployed) {
    console.log(`Offer not created to Nft(${nftAddress}).`);
    await sleep(30000);
    await waitOfferCreated(nftAddress);
  } else {
    console.log(`Offer CREATED to Nft(${nftAddress}) DirectBuy = ${event?.directBuy}`);
  }
}

async function getLastOffer() {
  const factoryDirectBuy: Contract<FactoryDirectBuyAbi> = await locklift.factory.getDeployedContract(
    "FactoryDirectBuy",
    new Address(FACTORY_DIRECT_BUY),
  );
  const lastDeploy = (
    await factoryDirectBuy.getPastEvents<"DirectBuyDeployed">({
      limit: 1,
      filter: event => event.event === "DirectBuyDeployed",
    })
  ).events.shift();
  return lastDeploy?.data ? lastDeploy?.data : null;
}

async function main() {
  const signer = await locklift.keystore.getSigner("0");
  const account = await migration.loadAccount("Account1");

  const factoryDirectBuy = await locklift.factory.getDeployedContract(
    "FactoryDirectBuy",
    new Address(FACTORY_DIRECT_BUY.toString())
  );

  const tokenRoot = await locklift.factory.getDeployedContract('VaultTokenRoot_V1', new Address(PAYMENT_TOKEN));

  const addressFTW = (await tokenRoot.methods.walletOf({walletOwner: new Address(FACTORY_DIRECT_BUY), answerId: 0}).call()).value0;

  await tokenRoot.methods.deployWallet({
    answerId: 0,
    walletOwner: factoryDirectBuy.address,
    deployWalletValue: toNano(0.1)
  }).send({
    from: account.address,
    amount: toNano(3)
  });

  const factoryWallet = await locklift.factory.getDeployedContract('VaultTokenWallet_V1', addressFTW);

  const response = await prompts([
    {
      type: "text",
      name: "collection",
      message: "Get Collection Address",
      validate: (value: any) =>
        isValidEverAddress(value) || value === ""
          ? true
          : "Invalid Everscale address"
    },
    {
        type: "number",
        name: "amount",
        message: "Get gift amount"
    },
  ]);

  const collection = (await locklift.factory.getDeployedContract(
      'Collection',
      new Address(response.collection.toString()))
  );
  console.log('Collection', response.collection.toString());

  const data = fs.readFileSync("nft_for_offer.json", 'utf8');
  if (data) nfts = JSON.parse(data);

  const gas = (await factoryDirectBuy.methods.getGasValue().call()).value0;
  const gasPrice = new BigNumber(1).shiftedBy(9).div(gas.gasK);
  let targetGas = new BigNumber(gas.make.dynamicGas).times(gasPrice).plus(gas.make.fixedValue).toNumber();
  let transferValue = new BigNumber(targetGas).plus(500000000);
  let requiredGas = new BigNumber(transferValue).times(nfts.length);

  const balanceStart = await locklift.provider.getBalance(account.address);

  if (requiredGas.gt(balanceStart)) {
    throw Error('NOT ENOUGH BALANCE ON ' + account.address + '. REQUIRES: ' + requiredGas.shiftedBy(-9).toString() + ' EVER')
  }

  const amountPerNft =  new BigNumber(response.amount).div(nfts.length).shiftedBy(9);

  console.log(`Start create offer for ${nfts.length} nfts.`)

  for (let i = 0; i < nfts.length; i++) {

    console.log('Start create offer for nftId:', nfts[i]);

    let { nft: nftAddress } = await collection.methods.nftAddress({ answerId: 0, id: nfts[i] }).call();

    // build payload for directBuy
    logger.log("Build payload");
    let targetPayload = (
      await factoryDirectBuy.methods
        .buildDirectBuyCreationPayload({
          callbackId: 0,
          buyer: account.address,
          nft:  new Address(nftAddress.toString()),
          startTime: START_TIME,
          durationTime: 0,
          discountCollection: null,
          discountNftId: null,
        })
      .call()
    ).value0;

    let callback: CallbackType;
    callback = [
      factoryDirectBuy.address,
      {
        value: targetGas,
        payload: targetPayload,
      },
    ];
    const callbacks: CallbackType[] = [];
    callbacks.push(callback);

    console.log(amountPerNft.plus(transferValue).toString());

    await factoryWallet.methods.acceptNative({
      amount: amountPerNft.toString(),
      deployWalletValue: toNano(0.1),
      remainingGasTo: account.address,
      payload: targetPayload
    }).send({
      from: account.address,
      amount: amountPerNft.plus(transferValue).toString()
    });

    await waitOfferCreated(new Address(nftAddress.toString()));
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
