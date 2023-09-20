import { isValidEverAddress } from "../test/utils";
import { Migration } from "./migration";
import { toNano } from "locklift";
import { Address } from "everscale-inpage-provider";
import { FactoryDirectSell } from "../test/wrappers/directSell";
import { json } from "stream/consumers";

const migration = new Migration();
const BigNumber = require("bignumber.js");
const prompts = require("prompts");
const logger = require("mocha-logger");

let collection_json: any;
let patterns: any[] = [];

async function main() {
  const signer = await locklift.keystore.getSigner("0");
  const account = await migration.loadAccount("Account1");
  await SimilarCollectionMigration(signer, account);

  const savedFactoryDirectSell = await migration.loadContract("FactoryDirectSell", "FactoryDirectSell");

  const savedCollection = await migration.loadContract("CollectionSimilar", "SimilarCollection");
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

  // build payload for directSell
  logger.log("Build payload");
  const targetPayload = (
    await factoryDirectSell.methods
      .buildDirectSellCreationPayload({
        _callbackId: 0,
        _startTime: 1695160632,
        _durationTime: 0,
        _paymentToken: new Address("0:2c3a2ff6443af741ce653ae4ef2c85c2d52a9df84944bbe14d702c3131da3f14"),
        _price: toNano(1),
        _recipient: new Address("0:afcc999c2a1ac2011d59a8d098f9fe414dbafe02c2c05736ce806be4e6bcdf5d"),
        _discountCollection: null,
        _discountNftId: null,
      })
      .call()
  ).value0;
  //deploy mintAndSell
  logger.log("Deploy mintAndSell");
  const mintAndSell = (
    await locklift.factory.deployContract({
      contract: "MintAndSell",
      publicKey: signer?.publicKey as string,
      constructorParams: {
        _owner: account.address,
        _collection: savedCollection.address,
        _targetManager: factoryDirectSell.address,
        _targetGas: targetGas,
        _targetPayload: targetPayload,
      },
      initParams: {
        nonce_: locklift.utils.getRandomNonce(),
      },
      value: toNano(1.6),
    })
  ).contract;
  logger.success(`MintAndSell: ${mintAndSell.address}`);
  // Transfer collection ownership to MintAndSell
  await locklift.tracing.trace(
    savedCollection.methods
      .transferOwnership({ newOwner: mintAndSell.address })
      .send({ from: account.address, amount: toNano(1) }),
  );
  logger.success("Transfer collection ownership to MintAndSell");

  migration.store(mintAndSell, "MintAndSell");
}
async function SimilarCollectionMigration(signer: any, account: any) {
  const Nft = await locklift.factory.getContractArtifacts("Nft");
  const Index = await locklift.factory.getContractArtifacts("Index");
  const IndexBasis = await locklift.factory.getContractArtifacts("IndexBasis");
  collection_json = [
    {
      collection: {
        type: "Basic NFT",
        name: "DiscoDance",
        description: "Just dance with me",
        preview: {
          source: "https://www.artmajeur.com/medias/standard/s/y/sybemol/artwork/16622434_dancing-cat07.jpg",
          mimetype: "image/png",
        },
        files: [
          {
            source: "https://www.artmajeur.com/medias/standard/s/y/sybemol/artwork/16622434_dancing-cat07.jpg",
            mimetype: "image/jpg",
          },
        ],
        external_url: "",
      },
      nfts: [
        {
          preview_url: "https://www.artmajeur.com/medias/standard/s/y/sybemol/artwork/16622434_dancing-cat07.jpg",
          previewMimeType: "image/png",
          url: "https://www.artmajeur.com/medias/standard/s/y/sybemol/artwork/16622434_dancing-cat07.jpg",
          fileMimeType: "image/png",
          name: "DiscoCat",
          description: "Dancing cat young and sweet only seventeen",
          externalUrl: "",
          attributes: [],
        },
      ],
    },
  ];
  // deploy collection
  logger.log("Deploy collection");

  const nfts = collection_json[0].nfts;

  for (let nft of nfts) {
    patterns.push({
      name: nft.name,
      description: nft.description,
      previewUrl: nft.preview_url,
      previewMimeType: nft.previewMimeType,
      fileUrl: nft.url,
      fileMimeType: nft.fileMimeType,
      externalUrl: nft.externalUrl,
      attributes: nft.attributes,
    });
  }

  const { contract: collection, tx } = await locklift.factory.deployContract({
    contract: "CollectionSimilar",
    publicKey: signer?.publicKey as string,
    constructorParams: {
      codeNft: Nft.code,
      codeIndex: Index.code,
      codeIndexBasis: IndexBasis.code,
      owner: account.address,
      remainOnNft: locklift.utils.toNano(1),
      json: JSON.stringify(collection_json[0].collection),
      patterns: patterns,
    },
    initParams: {
      nonce_: locklift.utils.getRandomNonce(),
    },
    value: locklift.utils.toNano(5),
  });
  logger.success(`Collection: ${collection.address}`);
  migration.store(collection, "SimilarCollection");
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
