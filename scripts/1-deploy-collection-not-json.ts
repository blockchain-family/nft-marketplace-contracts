import { isValidEverAddress} from "../test/utils";
import { Migration } from "./migration";
const migration = new Migration();
const ora = require('ora');
const prompts = require('prompts');
const BigNumber = require('bignumber.js');
const INCREMENT = 20;

async function main() {
    const signer = (await locklift.keystore.getSigner('0'));
    const account = await migration.loadAccount('Account1');

    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'Get Collection Owner Address (default ' + account.address + ')',
            validate: (value:string) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address'
        },
        {
            type: 'number',
            name: 'nftAmount',
            message: 'Provide how many copies to deploy',
            initial: 1
        }
    ]);

    var config: { [k: string]: any } = {};
    config.owner = response.owner;
    config.nftAmount = response.nftAmount;

    if (config.nftAmount > 0) {
        const response2 = await prompts([
            {
                type: 'text',
                name: 'nftOwner',
                message: 'Get NFTs Owner Address (default ' + account.address + ')',
                validate: (value:string) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address'
            },
            {
                type: 'text',
                name: 'nftName',
                message: 'Provide the nft name'
            },
            {
                type: 'text',
                name: 'nftDescription',
                message: 'Provide the nft description'
            },
            {
                type: 'text',
                name: 'nftUrl',
                message: 'Provide the image url'
            },
            {
                type: 'text',
                name: 'externalUrl',
                message: 'Provide the external url'
            },
        ]);

        config.nftName = response2.nftName;
        config.nftDescription = response2.nftDescription;
        config.nftUrl = response2.nftUrl;
        config.externalUrl = response2.externalUrl;
        config.nftOwner = response2.nftOwner;
    }


    const tx_results = []
    const amount = config.nftAmount;

    const requiredGas = new BigNumber(config.nftAmount).times(3.4).plus(5).shiftedBy(9);
    const balanceStart = await locklift.provider.getBalance(account.address);

    if (requiredGas.gt(balanceStart)) {
        throw Error('NOT ENOUGH BALANCE ON ' + account.address + '. REQUIRES: ' + requiredGas.shiftedBy(-9).toString() + ' EVER')
    }

    const spinner = ora('Deploying Collection').start();

    const Nft = (await locklift.factory.getContractArtifacts("Nft"));
    const Index = (await locklift.factory.getContractArtifacts("Index"));
    const IndexBasis = (await locklift.factory.getContractArtifacts("IndexBasis"));

    const { contract: collection, tx } = await locklift.factory.deployContract({
        contract: "Collection",
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            codeNft: Nft.code,
            codeIndex: Index.code,
            codeIndexBasis: IndexBasis.code,
            owner: account.address,
            remainOnNft: locklift.utils.toNano(1),
            json: "{}"
        },
        initParams: {
            nonce_: locklift.utils.getRandomNonce()
        },
        value: locklift.utils.toNano(4)
    });

    migration.store(collection, "Collection");

    if (config.nftAmount > 0) {
        spinner.text = 'Deploying Nfts'

        let obj = {
            "type": "Basic NFT",
            "name": config.nftName,
            "description": config.nftDescription,
            "preview": {
                "source": config.nftUrl,
                "mimetype": "image/png"
            },
            "files": [
                {
                    "source": config.nftUrl,
                    "mimetype": "image/png"
                }
            ],
            "external_url": config.externalUrl
        };

        const payloads = Array(amount).fill(obj).map(v => JSON.stringify(v))

        try {

            for (let i = 0; i < amount; i += INCREMENT) {
                spinner.text = `Minting NFT ${i}/${amount}:`
                let jsons = payloads.slice(i, i + INCREMENT);

                let tx = await collection.methods.batchMintNft({
                        _owner: (config.nftOwner || account.address),
                        _jsons: jsons
                    }).send({
                        from: account.address,
                        amount: locklift.utils.toNano(jsons.length * 3.3 + 2)
                    });

                spinner.text = `Minted NFT ${(i + 1) * INCREMENT}/${amount}: Tx: ${tx.id.hash}`
                tx_results.push({txStatus: tx.origStatus, txId: tx.id.hash, jsons})
            }
        } catch (e) {
            console.error(e)
        }
    }

    if(config.owner) {
        spinner.text = 'Transfer ownership back'
        await collection.methods.transferOwnership({
                newOwner: response.owner
        }).send({
            from: account.address,
            amount: locklift.utils.toNano(1)
        });
        console.log('Transfer ownership to: ' + config.owner)
    }
    console.log(tx_results)

    spinner.stopAndPersist({ text: 'Deploy complete' })
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
