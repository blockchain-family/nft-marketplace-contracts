npx locklift build

npx locklift test --disable-build --network local --tests test/1-auction-test.ts
npx locklift test --disable-build --network local --tests test/2-direct-buy-test.ts
npx locklift test --disable-build --network local --tests test/3-direct-sell-test.ts