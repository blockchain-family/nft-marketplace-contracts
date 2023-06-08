import { Migration } from "./migration";
import { isValidEverAddress} from "../test/utils";

const prompts = require('prompts')
const migration = new Migration();

async function main() {
    const response = await prompts([
        {
            type: 'text',
            name: 'owner',
            message: 'AuctionRootTip3 owner',
            validate: (value:any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address'
        },
        {
            type: 'text',
            name: 'weverRoot',
            message: 'Wever root address',
            validate: (value:any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address'
        },
        {
            type: 'text',
            name: 'weverVault',
            message: 'Wever vault address',
            validate: (value:any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address'
        }
    ]);

    const signer = (await locklift.keystore.getSigner('0'));
    const account = await migration.loadAccount('Account1');
    const Nft = (await locklift.factory.getContractArtifacts("Nft"));
    const Auction = (await locklift.factory.getContractArtifacts("Auction"));

    let fee = {
        numerator: 2,
        denominator: 100
    }

    const contractName = "FactoryAuction";
    const {contract: auctionRootTip3, tx} = await locklift.factory.deployContract({
        contract: contractName,
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _owner: account.address,
            _fee: fee,
            _auctionBidDelta: 500,
            _auctionBidDeltaDecimals: 10000,
            _remainingGasTo: account.address,
            _weverVault: response.weverVault,
            _weverRoot: response.weverRoot
        },
        initParams: {
           nonce_: locklift.utils.getRandomNonce(),
        },
        value: locklift.utils.toNano(10)
    });

    console.log(`FactoryAuction: ${auctionRootTip3.address.toString()}`)
    migration.store(auctionRootTip3, contractName);

    console.log(`Set code Auction`);
    await auctionRootTip3.methods.setCodeOffer({
        _newCode: Auction.code,
    }).send({
        from: account.address,
        amount: locklift.utils.toNano(1)
    })

    if (response.owner) {
        await auctionRootTip3.methods.transferOwnership({
            newOwner: response.owner
        }).send({
          from: account.address,
          amount: locklift.utils.toNano(1)
        });
    }
}

main()
.then(() => process.exit(0))
.catch(e => {
    console.log(e);
    process.exit(1);
});
