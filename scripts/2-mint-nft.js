// @ts-check
const ora = require('ora')
const prompts = require('prompts')
const fs = require('fs/promises')
const path = require('path')
const IPFS = require('ipfs-core')

const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();

const {
    deployMarket,
    deployAccount,
    deployTokenRoot,
    getAccount,
    Contract,
    LockLift,
    getRandomNonce,
    isValidTonAddress,
    logContract,
    getTotalSupply
} = require(process.cwd() + '/test/utils')

/** @type {LockLift} */
var locklift = global.locklift;

async function main() {
    const account = await locklift.factory.getAccount("Wallet");
    migration.load(account, 'Account')

    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'Owner (default '+account.address+')',
            validate: value => isValidTonAddress(value) || value === '' ? true : 'Invalid Everscale address'
        },
        {
            type: 'text',
            name: 'name',
            message: 'Provide the nft name'
        },
        {
            type: 'text',
            name: 'description',
            message: 'Provide the nft description'
        },
        {
            type: 'text',
            name: 'url',
            message: 'Provide the image url'
        },
        {
            type: 'text',
            name: 'externalUrl',
            message: 'Provide the external url'
        }
    ])

    await mint(response)
}

async function mint(response) {
    const [keyPair] = await locklift.keys.getKeyPairs();
    const account = await locklift.factory.getAccount("Wallet");
    migration.load(account, 'Account')
    const collection = await locklift.factory.getContract("Collection")
    migration.load(collection, 'Collection')

    console.log(`Collection: ${collection.address}`)
    console.log(`Account: ${account.address}`)

    const nft_url = response.url
    const nft_name = response.name
    const nft_description = response.description
    const externalUrl = response.externalUrl
    const spinner = ora('Deploying NFT').start();

    spinner.text = '[Minting NFT]'

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
    let tx = await account.runTarget({
        contract: collection,
        method: 'mintNft',
        params: {_owner: response.owner, _json: payload},
        keyPair,
        value: locklift.utils.convertCrystal(5, 'nano')
    })
    console.log(` Tx: ${tx.transaction.id}`)

    let totalMinted = await collection.call({method: 'totalMinted', params: {}});
    let nftAddress = await collection.call({method: 'nftAddress', params: {
        id: totalMinted.minus(1).toFixed()
    }});

    console.log(` NFT: ${nftAddress}`)

    spinner.stopAndPersist({text: 'Minting Completed'})
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
