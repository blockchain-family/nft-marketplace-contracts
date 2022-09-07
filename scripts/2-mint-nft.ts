import { isValidEverAddress} from "../test/utils";
import { Migration } from "./migration";

const migration = new Migration();
const ora = require('ora');
const prompts = require('prompts');

async function main() {
    const account = migration.load("Wallet", "Account1");

    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'Owner (default ' + account.address + ')',
            validate: (value:string) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address'
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
    
    const collection = locklift.factory.getDeployedContract("Collection", migration.load("Collection", "Collection").address);

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

    const accountFactory = locklift.factory.getAccountsFactory("Wallet");
    const signer = (await locklift.keystore.getSigner('0'));  
    const acc = accountFactory.getAccount(account.address, (signer?.publicKey) as string);
    await locklift.tracing.trace(acc.runTarget(
        {
            contract: collection,
            value: locklift.utils.toNano(10)
        },
        (nft) => nft.methods.mintNft({
            _owner: response.owner,
            _json: payload
        
        }),
    ));

    let totalMinted = await collection.methods.totalMinted({answerId: 0}).call()
    let nftAddress = await collection.methods.nftAddress({answerId: 0, id: (Number(totalMinted.count)-1).toFixed()}).call()
    console.log(` NFT: ${nftAddress.nft}`)

    spinner.stopAndPersist({text: 'Minting Completed'})
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });