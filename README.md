
## **How to create collection with NFT and put its on sell**
For base information about NFT standarts, please, check [TIP-4] (https://docs.venom.foundation/standards/TIP/TIP-4/core-description )

### Update dependencies
`npm install`

### Build project
`npx locklift build`

### Prepare jsons metadata for Collection and NFT
For more information [TIP-4.2] (https://docs.venom.foundation/standards/TIP/TIP-4/2)
 
You need prepare json file with similar structure (file nft_to_address.json):

```{
    "collection": {
            "type": "Basic NFT",
            "name": "Sample Name",
            "description": "Description about NFT collection!",
            "preview": {
                "source": "",
                "mimetype": "image/jpeg"
            },
            "files": [
                {
                    "source": "",
                    "mimetype": "image/jpeg"
                }
            ],
            "external_url": ""
    },
    "nfts":
        [
            {
                "address": "",
                "type": "Basic NFT",
                "preview_url":	"",
                "mimetype_preview": "image/jpeg",
                "url": "",
                "mimetype": "image/jpeg",
                "name": "Nft Name",
                "description": "Nft description",
                "external_url": ""
            }
        ]
}
 ```
#### Collection

`preview`  - preview-logo. We recommend: ratio 1:1, recommended dimensions 1000x1000px, jpeg, size less 200Kb.
    Where `source` - link to Collection preview.

`files` - wallpaper. We recommend: 4:1 ratio, recommended dimensions 4000x1000px, jpeg
    Where `source` - link to Collection wallpaper.

#### NFT
`address` - owner's address  NFT, if you would like put nft on sell this address have to equal account address

`preview_url` - link to NFT logo. We recommend: recommended dimensions 512x512, ratio 1:1, jpeg, size no more than 200Kb 

`url` - link to NFT main file. It may be pdf, docs, jpeg, gif, png, audio, video


### Before use script
Сonfigure `.env` and `locklift.config.ts`

### Deploy account
`npx locklift run --disable-build --network venom_mainnet --script scripts/0-deploy-account.ts - b N`
Where `N = (count of NFT * 1.6) + 2.5`

or use giver as account. Create or change file `migration_log.json`
```
{
  "Account1": "",
}
```
where `Account1` - giver address.


### Deploy Collection and mint NFT

`npx locklift run --disable-build --network venom_mainnet --script scripts/1-deploy-collection-mint-nft-from-json.ts`

### Then put NFTs on sell after deploy

`npx locklift run --disable-build --network venom_mainnet --script scripts/151-put-nft-to-sell.ts`
Set constant:
`PAYMENT_TOKEN` - tip3 token, for Venom - wVenom (address 0:77d36848bb159fa485628bc38dc37eadb74befa514395e09910f601b841f749e)
`RECIPIENT` - Nft's owner
`FACTORY_DIRECT_SELL` - address root contract for sale on marketplace (valid for now 0:4444a335e94794c6869c061c0f657c761011fa229b67ee7101538be18d01ecef)
`START_TIME` - start tile for sale
`PRICE` - prise
You also can set durationTime for sale.

### Royalty 
For deploy NFT with royalty use next script
`npx locklift run --disable-build --network venom_mainet --script scripts/3-deploy-collection-nft-from-json-with-royalty.ts`


<p align="center">
  <a href="https://github.com/venom-blockchain/developer-program">
    <img src="https://raw.githubusercontent.com/venom-blockchain/developer-program/main/vf-dev-program.png" alt="Logo" width="366.8" height="146.4">
  </a>
</p>

<p align="center">
    <h3 align="center">NFT-marketplace contracts</h3>
    <p align="center">Implementation of auction, direct sell, direct buy.</p>
</p>
