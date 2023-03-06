import { LockliftConfig } from "locklift";
import { FactorySource } from "./build/factorySource";
import { SimpleGiver, GiverWallet, TestnetGiver, GiverWalletV2_3 } from "./giverSettings";

declare global {
  const locklift: import("locklift").Locklift<FactorySource>;
}

const LOCAL_NETWORK_ENDPOINT = "http://localhost/graphql";

const config: LockliftConfig = {
  compiler: {
    // Specify path to your TON-Solidity-Compiler
    // path: "/mnt/o/projects/broxus/TON-Solidity-Compiler/build/solc/solc",

    // Or specify version of compiler
    version: "0.61.2",

    // Specify config for extarnal contracts as in exapmple
    // externalContracts: {
    //   "node_modules/broxus-ton-tokens-contracts/build": ['TokenRoot', 'TokenWallet']
    // }
    externalContracts: {
      "precompiled": ['Index', 'IndexBasis'],
      "node_modules/tip3/build": ['TokenRootUpgradeable', 'TokenWalletUpgradeable', 'TokenWalletPlatform']
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
      connection: {
        id: 1337,
        group: 'localnet',
        type: 'graphql',
        data: {
          endpoints: [LOCAL_NETWORK_ENDPOINT],
          latencyDetectionInterval: 1000,
          local: true,
        },
      },
      giver: {
        giverFactory: (ever, keyPair, address) => new SimpleGiver(ever, keyPair, address),
        address: '0:ece57bcc6c530283becbbd8a3b24d3c5987cdddc3c8b7b33be6e4a6312490415',
        key: '172af540e43a524763dd53b26a066d472a97c4de37d5498170564510608250c3',
      },
      tracing: { endpoint: LOCAL_NETWORK_ENDPOINT },
      keys: {
        phrase: 'action inject penalty envelope rabbit element slim tornado dinner pizza off blood',
        amount: 20,
      },
    },
    test: {
      // Specify connection settings for https://github.com/broxus/everscale-standalone-client/
      connection: {
        group: "testnet",
        // @ts-ignore
        type: "graphql",
        data: {
          // @ts-ignore
          endpoints: [process.env.TESTNET_GQL_ENDPOINT],
          latencyDetectionInterval: 1000,
          local: false,
        },
      },
      // This giver is default local-node giverV2
      giver: {
        // Check if you need provide custom giver
        giverFactory: process.env.TESTNET_GIVER_TYPE == "Wallet" ?
            (ever, keyPair, address) => new GiverWallet(ever, keyPair, address) :
            (ever, keyPair, address) => new TestnetGiver(ever, keyPair, address),
        address: process.env.TESTNET_GIVER_ADDRESS ?? "",
        phrase: process.env.TESTNET_GIVER_SEED ?? "",
        accountId: 0
      },
      tracing: {
        endpoint: process.env.TESTNET_GQL_ENDPOINT ?? ""
      },

      keys: {
        phrase: process.env.TESTNET_SEED_PHRASE ?? "",
        amount: 20
      },
    },
    main: {
      connection: "mainnetJrpc",
      giver: {
        // Mainnet giver has the same abi as testnet one
        giverFactory: process.env.MAIN_GIVER_TYPE == "Wallet" ?
            (ever, keyPair, address) => new GiverWallet(ever, keyPair, address) :
            (ever, keyPair, address) => new TestnetGiver(ever, keyPair, address),
        address: process.env.MAIN_GIVER_ADDRESS ?? "",
        phrase: process.env.MAIN_GIVER_SEED ?? "",
        accountId: 0
      },
      tracing: {
        endpoint: process.env.MAIN_GQL_ENDPOINT ?? ""
      },
      keys: {
        phrase: process.env.MAIN_SEED_PHRASE ?? "",
        amount: 20
      }
    },
    venom: {
      connection: {
        group: 'mainnet',
        id: 1000,
        type: 'graphql',
        data: {
          endpoints: ['https://gql.venom.foundation/graphql'],
          latencyDetectionInterval: 1000,
          local: false,
        },
      },
      giver: {
        giverFactory: (ever, keyPair, address) =>
          new GiverWalletV2_3(ever, keyPair, address),
        address: process.env.VENOM_MAIN_GIVER_ADDRESS ?? "",
        phrase: process.env.VENOM_MAIN_GIVER_SEED ?? "",
        accountId: 0,
      },
      tracing: {
        endpoint: 'https://gql.venom.foundation/graphql',
      },
      keys: {
        phrase: process.env.VENOM_MAIN_SEED_PHRASE ?? "",
        amount: 20,
      },
    },
  },
  mocha: {
    timeout: 2000000
  },
};

export default config;
