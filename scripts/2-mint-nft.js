// @ts-check
const ora = require('ora')
const prompts = require('prompts')
const fs = require('fs/promises')
const path = require('path')
const IPFS = require('ipfs-core')

const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();

const { deployMarket, deployAccount, deployTokenRoot, getAccount, Contract, LockLift, getRandomNonce, isValidTonAddress, logContract, getTotalSupply } = require('../test/utils')

/** @type {LockLift} */
var locklift = global.locklift;

async function main() {

    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'Owner',
            validate: value => isValidTonAddress(value) ? true : 'Invalid Everscale address'
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

    const nft_url = response.url
    const nft_name = response.name
    const nft_description = response.description
    const externalUrl = response.externalUrl
    const spinner = ora('Deploying NFT').start();

    spinner.text = 'Minting Nfts to Market'

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
    spinner.text = `Minting NFT ${i+start}/${amount+start}: ${item.image_url}:`
    let payload = JSON.stringify(item)
    let tx = await account.runTarget({
        contract: collection,
        method: 'mintNft',
        params: { owner: response.owner, json: payload },
        keyPair,
        value: locklift.utils.convertCrystal(5, 'nano')
    })
    console.log(`Minted NFT: ${nft_url}: Tx: ${tx.transaction.id}`)

    migration.store(temp, 'Account');

    spinner.stopAndPersist({text: 'Minting Completed, Outputting Result'})
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
