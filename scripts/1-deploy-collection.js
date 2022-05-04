// @ts-check
const BigNumber = require('bignumber.js');

const ora = require('ora')
const prompts = require('prompts')

const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();

const {
    deployCollection,
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

const INCREMENT = 20;

/** @type {LockLift} */
var locklift = global.locklift;

async function main() {

    const [keyPair] = await locklift.keys.getKeyPairs();

    const tempAdmin = await locklift.factory.getAccount("Wallet");
    migration.load(tempAdmin, 'Account')
    tempAdmin.setKeyPair(keyPair)

    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'Get Collection Owner Address (default '+tempAdmin.address+')',
            validate: value => isValidTonAddress(value) || value === '' ? true : 'Invalid Everscale address'
        },
        {
            type: 'number',
            name: 'nftAmount',
            message: 'Provide how many copies to deploy',
            initial: 1
        }
    ])

    let config = {
        owner: response.owner,
        nftAmount: response.nftAmount
    }

    if (config.nftAmount > 0) {
        const response2 = await prompts([
            {
                type: 'text',
                name: 'nftOwner',
                message: 'Get NFTs Owner Address (default '+tempAdmin.address+')',
                validate: value => isValidTonAddress(value) || value === '' ? true : 'Invalid Everscale address'
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
        ])

        config.nftName = response2.nftName;
        config.nftDescription = response2.nftDescription;
        config.nftUrl = response2.nftUrl;
        config.externalUrl = response2.externalUrl;
        config.nftOwner = response2.nftOwner;

    }

    const tx_results = []
    /** @type {number} **/
    const amount = config.nftAmount;

    const requiredGas = new BigNumber(config.nftAmount).times(3.4).plus(5).shiftedBy(9);
    const balanceStart = await locklift.ton.getBalance(tempAdmin.address);

    if (requiredGas.gt(balanceStart)) {
        throw Error('NOT ENOUGH BALANCE ON ' + account.address + '. REQUIRES: ' + requiredGas.shiftedBy(-9).toString() + ' EVER')
    }

    const spinner = ora('Deploying Collection').start();
    let collection = await deployCollection(tempAdmin, {remainOnNft: 0.3})
    migration.store(collection, 'Collection');
    await logContract(collection)

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
                spinner.text = `Minting NFT ${i}/${amount}: ${config.nftUrl}:`
                let jsons = payloads.slice(i, i + INCREMENT);

                let tx = await tempAdmin.runTarget({
                    contract: collection,
                    method: 'batchMintNft',
                    params: {_owner: config.nftOwner || tempAdmin.address , _jsons: jsons},
                    keyPair,
                    value: locklift.utils.convertCrystal(jsons.length * 3.3 + 2, 'nano')
                })
                spinner.text = `Minted NFT ${(i + 1) * INCREMENT}/${amount}: Tx: ${tx.transaction.id}`
                tx_results.push({txStatus: tx.transaction.status_name, txId: tx.transaction.id, jsons})
            }
        } catch (e) {
            console.error(e)
        }
    }

    if(config.owner) {
        spinner.text = 'Transfer ownership back'

        await tempAdmin.runTarget({
            contract: collection,
            method: 'transferOwnership',
            params: {
                newOwner: config.owner
            },
            keyPair,
            value: locklift.utils.convertCrystal(1, 'nano')
        })
        console.log('Transfer ownership to: ' + config.owner)
    }


    await logContract(collection)
    console.log(tx_results)

    spinner.stopAndPersist({text: 'Deploy complete'})

}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
