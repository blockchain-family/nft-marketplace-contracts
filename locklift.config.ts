import { LockliftConfig } from "locklift";
import { FactorySource } from "./build/factorySource";
import { SimpleGiver, GiverWallet, TestnetGiver } from "./giverSettings";

declare global {
  const locklift: import("locklift").Locklift<FactorySource>;
}

const LOCAL_NETWORK_ENDPOINT = "http://localhost/graphql";

const config: LockliftConfig = {
  compiler: {
    // Specify path to your TON-Solidity-Compiler
    // path: "/mnt/o/projects/broxus/TON-Solidity-Compiler/build/solc/solc",

    // Or specify version of compiler
    version: "0.62.0",

    // Specify config for extarnal contracts as in exapmple
    // externalContracts: {
    //   "node_modules/broxus-ton-tokens-contracts/build": ['TokenRoot', 'TokenWallet']
    // }
    externalContracts: {
      "precompiled": ['TokenWalletPlatform', 'Index', 'IndexBasis'],
      "node_modules/ton-eth-bridge-token-contracts/build": ['TokenRootUpgradeable', 'TokenWalletUpgradeable']
    }
  },
  linker: {
    // Specify path to your stdlib
    // lib: "/mnt/o/projects/broxus/TON-Solidity-Compiler/lib/stdlib_sol.tvm",
    // // Specify path to your Linker
    // path: "/mnt/o/projects/broxus/TVM-linker/target/release/tvm_linker",

    // Or specify version of linker
    version: "0.15.48",
  },
  networks: {
    local: {
      // Specify connection settings for https://github.com/broxus/everscale-standalone-client/
      connection: {
        group: "localnet",
        type: "graphql",
        data: {
          endpoints: [LOCAL_NETWORK_ENDPOINT],
          latencyDetectionInterval: 1000,
          local: true,
        },
      },
      // This giver is default local-node giverV2
      giver: {
        // Check if you need provide custom giver
        giverFactory: (ever, keyPair, address) => new SimpleGiver(ever, keyPair, address),
        address: "0:ece57bcc6c530283becbbd8a3b24d3c5987cdddc3c8b7b33be6e4a6312490415",
        key: "172af540e43a524763dd53b26a066d472a97c4de37d5498170564510608250c3",
      },
      tracing: {
        endpoint: LOCAL_NETWORK_ENDPOINT,
      },
      keys: {
        // Use everdev to generate your phrase
        // !!! Never commit it in your repos !!!
        // phrase: "action inject penalty envelope rabbit element slim tornado dinner pizza off blood",
        amount: 20,
        phrase: "action inject penalty envelope rabbit element slim tornado dinner pizza off blood",
      },
    },
    dev: {
      connection: "testnet",

      giver: {
        giverFactory: (ever, keyPair, address) => new TestnetGiver(ever, keyPair, address),
        address: "0:a4053fd2e9798d0457c9e8f012cef203e49da863d76f36d52d5e2e62c326b217",
        key: "2d572a3f1b2ce83f4bcf83ae55da7d61b670ecc58530f5467f57d909db6cd6c3",
      },
      keys: {
        phrase:"fringe scene sound floor number umbrella undo tomato seed best tourist hard",
        amount: 20 
      }
    },
    
    mainnet: {
      // Specify connection settings for https://github.com/broxus/everscale-standalone-client/
      connection: "mainnet",
      // This giver is default Wallet
      giver: {
        // Check if you need provide custom giver
        giverFactory: (ever, keyPair, address) => new GiverWallet(ever, keyPair, address),
        address: "0:9be58a09cc9f33c2f2f78f5cb91e7cda53673b4dd179acfeda06505a88e21a00",
        phrase: "",
        accountId: 0
      },
      keys: {
        // Use everdev to generate your phrase
        // !!! Never commit it in your repos !!!
        phrase: "action inject penalty envelope rabbit element slim tornado dinner pizza off blood",
        // phrase: "",
        amount: 20,
      },
    },
  },
  mocha: {
    timeout: 2000000
  },
};

export default config;
