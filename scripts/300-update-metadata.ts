import { isValidEverAddress } from "../test/utils";
import { Migration } from "./migration";

const migration = new Migration();
const request = require('request');
const prompts = require('prompts');

async function main() {

    const response = await prompts([
        {
            type: 'text',
            name: 'collection',
            message: 'Get Collection address',
            validate: (value: any) => isValidEverAddress(value) || value === '' ? true : 'Invalid Everscale address',
        }
    ]);

    let options = {
      'method': 'POST',
      'url': 'https://indexer-venom.bf.works/metadata/refresh/',
      'headers': {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "collection": response.collection.toString()
      })

    };
    request(options, function (error: any, response: any) {
      if (error) throw new Error(error);
      console.log(response.body);
    });

}

main()
.then(() => process.exit(0))
.catch(e => {
    console.log(e);
    process.exit(1);
});