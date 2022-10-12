npx locklift build

# npx locklift run --disable-build --network local --script scripts/0-reset-migration.ts
# npx locklift run --disable-build --network local --script scripts/0-deploy-account.ts --key_number='0' --balance='50'
# npx locklift run --disable-build --network local --script scripts/0-deploy-account.ts --key_number='1' --balance='50'
# npx locklift run --disable-build --network local --script scripts/0-deploy-account.ts --key_number='2' --balance='50'
# npx locklift run --disable-build --network local --script scripts/10-deploy-auction-root.ts 
# npx locklift run --disable-build --network local --script scripts/15-deploy-direct_buy-factory.ts
# npx locklift run --disable-build --network local --script scripts/17-deploy-direct_sell-factory.ts
# npx locklift run --disable-build --network local --script scripts/100-send-evers-to.ts
# npx locklift run --disable-build --network local --script scripts/1-deploy-collection.ts
# npx locklift run --disable-build --network local --script scripts/2-mint-nft.ts 
# npx locklift run --disable-build --network local --script scripts/mint-nft-from-json.ts

# npx locklift run --disable-build --network dev --script scripts/0-reset-migration.ts
# npx locklift run --disable-build --network dev --script scripts/0-deploy-account.ts --key_number='0' --balance='50'
# npx locklift run --disable-build --network dev --script scripts/10-deploy-auction-root.ts 
# npx locklift run --disable-build --network dev --script scripts/15-deploy-direct_buy-factory.ts
# npx locklift run --disable-build --network dev --script scripts/17-deploy-direct_sell-factory.ts

npx locklift run --disable-build --network mainnet --script scripts/0-reset-migration.ts
npx locklift run --disable-build --network mainnet --script scripts/0-deploy-account.ts --key_number='0' --balance='20'
npx locklift run --disable-build --network mainnet --script scripts/10-deploy-auction-root.ts 
npx locklift run --disable-build --network mainnet --script scripts/15-deploy-direct_buy-factory.ts
npx locklift run --disable-build --network mainnet --script scripts/17-deploy-direct_sell-factory.ts
# npx locklift run --disable-build --network mainnet --script scripts/100-send-evers-to.ts

# npx locklift test --disable-build --network local --tests test/1-auction-test.ts