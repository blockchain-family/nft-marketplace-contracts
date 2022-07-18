npx locklift build --config locklift.config.js

npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/0-reset-migration.js
npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/0-deploy-account.js --key_number='0' --balance='10'
npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/10-deploy-auction-root.js 
npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/15-deploy-direct_buy-factory.js