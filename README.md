
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
`address` - owner's address  NFT,

`preview_url` - link to NFT logo. We recommend: recommended dimensions 512x512, ratio 1:1, jpeg, size no more than 200Kb 

`url` - link to NFT main file. It may be pdf, docs, jpeg, gif, png, audio, video

### Deploy Collection and mint NFT

### Deploy Collection and mint NFT and put its on sale

Use script `1-deploy-collection-mint-nft-from-json.ts`


<p align="center">
  <a href="https://github.com/venom-blockchain/developer-program">
    <img src="https://raw.githubusercontent.com/venom-blockchain/developer-program/main/vf-dev-program.png" alt="Logo" width="366.8" height="146.4">
  </a>
</p>

<p align="center">
    <h3 align="center">NFT-marketplace contracts</h3>
    <p align="center">Implementation of auction, direct sell, direct buy.</p>
</p>
