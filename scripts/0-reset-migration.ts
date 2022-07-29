import { Migration } from "./migration";

const migration = new Migration();

async function main() {
    migration.reset();
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });