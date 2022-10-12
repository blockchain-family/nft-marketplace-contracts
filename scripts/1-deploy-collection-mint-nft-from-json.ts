import { isValidEverAddress} from "../test/utils";
import { Migration } from "./migration";

const migration = new Migration();
const BigNumber = require('bignumber.js');
const fs = require('fs')
const prompts = require('prompts')


let array_json: any;

async function main() {
    const account = migration.load("Wallet", "Account1");
    const signer = (await locklift.keystore.getSigner('0'));

    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'Get Collection Owner Address (default ' + account.address + ')',
            validate: (value: any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address'
        }
    ]);

    const data = fs.readFileSync("nft_to_address.json", 'utf8');
    if (data) array_json = JSON.parse(data);

    const requiredGas = new BigNumber(array_json.length).times(3.4).plus(5).shiftedBy(9);
    const balanceStart = await locklift.provider.getBalance(account.address);

    if (requiredGas.gt(balanceStart)) {
        throw Error('NOT ENOUGH BALANCE ON ' + account.address + '. REQUIRES: ' + requiredGas.shiftedBy(-9).toString() + ' EVER')
    }

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
            remainOnNft: locklift.utils.toNano(0.2),
            json: JSON.stringify(array_json.collection)
        },
        initParams: {
            nonce_: locklift.utils.getRandomNonce()
        },
        value: locklift.utils.toNano(4)
    });

    migration.store(collection.address, "Collection", "Collection");

    if (array_json.nfts) {
        for (const element of array_json.nfts) {
            let item = {
                "type": "Basic NFT",
                "name": element.name,
                "description": element.description,
                "preview": {
                    "source": element.preview_url,
                    "mimetype": "image/png"
                },
                "files": [
                    {

                        "source": element.url,
                        "mimetype": "image/png"
                    }
                ],
                "external_url": "https://flatqube.io/"
            }
            let payload = JSON.stringify(item)
            let accountFactory = await locklift.factory.getAccountsFactory('Wallet');
            const acc = accountFactory.getAccount(account.address, (signer?.publicKey) as string);
            let tx = await acc.runTarget({
                contract: collection,
                value: locklift.utils.toNano(5),
            },
            (collNFT) => collNFT.methods.mintNft({
                _owner: element.address != "" ? element.address:account.address,
                _json: payload,
            }));
            
            console.log(` Tx: ${tx.transaction.id}`)
        }
    }

    if (response.owner) {
        let accountFactory = locklift.factory.getAccountsFactory('Wallet');
        const acc = accountFactory.getAccount(account.address,  (signer?.publicKey) as string);
        await acc.runTarget(
            {
                contract: collection,
                value: locklift.utils.toNano(1),
            },
            (auction) => auction.methods.transferOwnership({
                newOwner: response.owner
            }),
        );
    }   
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });