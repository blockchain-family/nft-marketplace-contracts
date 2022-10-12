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
        }
    ]);

    const account = migration.load("Wallet", "Account1");
    const signer = (await locklift.keystore.getSigner('0'));

    const Nft = (await locklift.factory.getContractArtifacts("Nft"));
    const AuctionTip3 = (await locklift.factory.getContractArtifacts("AuctionTip3"));

    const contractName = "AuctionRootTip3";
    const {contract: auctionRootTip3, tx} = await locklift.factory.deployContract({
        contract: contractName,
        publicKey: (signer?.publicKey) as string,
        constructorParams: {
            _codeNft: Nft.code,
            _owner: account.address,
            _offerCode: AuctionTip3.code,
            _deploymentFee: 0,
            _marketFee: 0,
            _marketFeeDecimals: 0,
            _auctionBidDelta: 100,
            _auctionBidDeltaDecimals: 1,
            _sendGasTo: account.address
            
        },
        initParams: {
           nonce_: locklift.utils.getRandomNonce(),
        },
        value: locklift.utils.toNano(10)
    });

    console.log(`AuctionRootTip3: ${auctionRootTip3.address.toString()}`)
    migration.store(auctionRootTip3.address, contractName, contractName);

    if (response.owner) {
        let accountFactory = locklift.factory.getAccountsFactory('Wallet');
        const acc = accountFactory.getAccount(account.address,  (signer?.publicKey) as string);
        await acc.runTarget(
            {
                contract: auctionRootTip3,
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
