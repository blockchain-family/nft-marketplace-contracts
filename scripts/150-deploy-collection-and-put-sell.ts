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

let array_json: any;
type Royalty = {
  numerator: number;
  denominator: number;
  receiver: Address;
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isNftDeployed(collection: Address, nftId: number) {
  const collectionRoyalty: Contract<CollectionRoyaltyAbi> = await locklift.factory.getDeployedContract(
    "CollectionRoyalty",
    collection,
  );
  let { nft: nftAddress } = await collectionRoyalty.methods.nftAddress({ answerId: 0, id: nftId }).call();
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
  console.log(lastId);
  console.log(nftDeployed);
  console.log((lastId < nftId || !nftDeployed));

  if (!nftDeployed) {
    console.log(`Last event nft id: ${lastId}/${nftId}`);
    await sleep(30000);
    await waitNftMinted(collection, nftId);
  } else {
    console.log(`All minted`);
  }
}

async function getLastNftId(collection: Address) {
  const collectionRoyalty: Contract<CollectionRoyaltyAbi> = await locklift.factory.getDeployedContract(
    "CollectionRoyalty",
    collection,
  );
  const lastNFTCreated = (
    await collectionRoyalty.getPastEvents<"NftCreated">({
      limit: 1,
      filter: event => event.event === "NftCreated",
    })
  ).events.shift();
  return lastNFTCreated?.data?.id ? parseInt(lastNFTCreated?.data?.id) : 0;
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

  // let result = await deployWnativeRoot('wnativeTest', 'WTest', account);
  // let wnativeRoot = result['root'];
  // console.log(wnativeRoot.address);
  // local wnative = "0:1fd59df9c396130d81a14dad6df5272b9cd073d06516b2f97dd360e13866e589"

  let royalty_ = {
    numerator: 1,
    denominator: 100,
    receiver: new Address("")
  } as Royalty;

  const data = fs.readFileSync("nft_metadata_venom_test.json", 'utf8');
  if (data) array_json = JSON.parse(data);

  const requiredGas = new BigNumber(array_json.nfts.length).times(1.6).plus(1).shiftedBy(9);
  const balanceStart = await locklift.provider.getBalance(account.address);

  if (requiredGas.gt(balanceStart)) {
    throw Error('NOT ENOUGH BALANCE ON ' + account.address + '. REQUIRES: ' + requiredGas.shiftedBy(-9).toString() + ' EVER')
  }

  const Nft = (await locklift.factory.getContractArtifacts("NftWithRoyalty"));
  const Index = (await locklift.factory.getContractArtifacts("Index"));
  const IndexBasis = (await locklift.factory.getContractArtifacts("IndexBasis"));

  console.log("account balance", await locklift.provider.getBalance(account.address));

  console.log('Start deploy collection');
  const { contract: collection, tx } = await locklift.factory.deployContract({
    contract: "CollectionRoyalty",
    publicKey: (signer?.publicKey) as string,
    constructorParams: {
      codeNft: Nft.code,
      codeIndex: Index.code,
      codeIndexBasis: IndexBasis.code,
      owner: account.address,
      remainOnNft: locklift.utils.toNano(0.5),
      json: JSON.stringify(array_json.collection)
    },
    initParams: {
      nonce_: locklift.utils.getRandomNonce()
    },
    value: locklift.utils.toNano(2)
  });

  // const collection = (await locklift.factory.getDeployedContract('CollectionRoyalty', new Address('0:6614e8351d88b1e617fe65a16b6d30224cb3b6c6cda16b4feaaa3ae3c2cb8fe6')));
  console.log('CollectionRoyalty', collection.address.toString());
  migration.store(collection, "CollectionRoyalty");

  const savedFactoryDirectSell = await migration.loadContract("FactoryDirectSell", "FactoryDirectSell");
  // const collection = await migration.loadContract("CollectionRoyalty", "CollectionRoyalty");
  const response = await prompts([
    {
      type: "text",
      name: "factoryDirectSell",
      message: "Get FactoryDirectSell address (default " + savedFactoryDirectSell.address + ")",
      validate: (value: any) => (isValidEverAddress(value) || value === "" ? true : "Invalid Everscale address"),
      initial: savedFactoryDirectSell.address,
    },
  ]);

  const factoryDirectSell = await locklift.factory.getDeployedContract(
    "FactoryDirectSell",
    new Address(response.factoryDirectSell.toString()),
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
        _startTime: 1710333200,
        _durationTime: 0,
        _paymentToken: new Address(""),
        _price: toNano(0.000001),
        _recipient: new Address(""),
        _discountCollection: null,
        _discountNftId: null,
      })
      .call()
  ).value0;

  const lastNFTCreated = await getLastNftId(collection.address);
  const from: number = Math.max(lastNFTCreated, 0) ;

  if (array_json.nfts) {
    // for (const element of array_json.nfts) {
    for (let i = from; i < array_json.nfts.length; i++) {
      let element = array_json.nfts[i];
      console.log("account balance", await locklift.provider.getBalance(account.address));
      console.log(`Mint ${element.name}`);

      await collection.methods.mintNft({
        _owner: account.address,
        _json: JSON.stringify(element),
        _royalty: royalty_
      }).send({
        from: account.address,
        amount: locklift.utils.toNano(1.6)
      })

      await waitNftMinted(collection.address, i);
      //console.log(` Tx: ${tx.transaction.id}`)

      console.log(`Sale ${element.name}`);

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

      let { nft: nftAddress } = await collection.methods.nftAddress({ answerId: 0, id: i }).call();
      const Nft = await locklift.factory.getDeployedContract("NftWithRoyalty", nftAddress);

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
    const response2 = await prompts([
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
  if (response2.owner) {
    console.log(response2.owner);
    console.log(`Transfer ownership for collection`);
    await collection.methods
      .transferOwnership({
        newOwner: response2.owner,
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
