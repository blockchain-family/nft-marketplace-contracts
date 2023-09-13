import { LockliftConfig, lockliftChai } from "locklift";
import { FactorySource } from "./build/factorySource";
import '@broxus/locklift-verifier';
import { Deployments } from '@broxus/locklift-deploy';
import * as dotenv from 'dotenv';

dotenv.config();

import chai from 'chai';
chai.use(lockliftChai);


declare module 'locklift' {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  export interface Locklift {
    deployments: Deployments<FactorySource>;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const locklift: import('locklift').Locklift<FactorySource>;
}

const config: LockliftConfig = {
  compiler: {
    version: "0.62.0",
    externalContracts: {
      "node_modules/tip3": ['TokenRootUpgradeable', 'TokenWalletUpgradeable']
    },
    externalContractsArtifacts: {
      "precompiled": ['Index', 'IndexBasis'],
      "node_modules/ever-wever/build" : ['VaultTokenRoot_V1', 'VaultTokenWallet_V1'],
      "node_modules/tip3/build": ['TokenWalletPlatform']
    }
  },
  linker: {
    version: "0.15.48",
  },
  verifier: {
    verifierVersion: 'latest', // contract verifier binary, see https://github.com/broxus/everscan-verify/releases
    apiKey: process.env.EVERSCAN_API_KEY ?? '',
    secretKey: process.env.EVERSCAN_SECRET_KEY ?? '',
  },
  networks: {
    locklift: {
      giver: {
        address: process.env.LOCAL_GIVER_ADDRESS!,
        key: process.env.LOCAL_GIVER_KEY!,
      },
      connection: {
        id: 1001,
        type: "proxy",
        // @ts-ignore
        data: {}
      },
      keys: {
        phrase: process.env.LOCAL_PHRASE,
        amount: 20,
      },
    },
    local: {
      connection: {
        id: 1337,
        group: 'localnet',
        type: 'graphql',
        data: {
          endpoints: [process.env.LOCAL_NETWORK_ENDPOINT!],
          latencyDetectionInterval: 1000,
          local: true,
        },
      },
      giver: {
        address:
            '0:ece57bcc6c530283becbbd8a3b24d3c5987cdddc3c8b7b33be6e4a6312490415',
        key: '172af540e43a524763dd53b26a066d472a97c4de37d5498170564510608250c3',
      },
      keys: {
        phrase:
            'action inject penalty envelope rabbit element slim tornado dinner pizza off blood',
        amount: 20,
      },
    },
    main: {
      connection: {
        id: 1,
        type: 'jrpc',
        group: 'main',
        data: {
          endpoint: process.env.MAINNET_RPC_NETWORK_ENDPOINT ?? '',
        },
      },
      giver: {
        address: process.env.MAINNET_GIVER_ADDRESS ?? '',
        key: process.env.MAINNET_GIVER_KEY ?? '',
      },
      keys: {
        phrase: process.env.MAINNET_PHRASE,
        amount: 20,
      },
    },
    venom_testnet: {
      connection: {
        group: "testnet",
        id: 1010,
        type: "jrpc",
        data: {
          endpoint: "https://jrpc-testnet.venom.foundation/rpc"
        },
      },
      giver: {
        address: process.env.VENOM_TESTNET_GIVER_ADDRESS ?? "",
        phrase: process.env.VENOM_TESTNET_GIVER_PHRASE ?? "",
        accountId: 0,
      },
      keys: {
        phrase: process.env.VENOM_TESTNET_PHRASE ?? "",
        amount: 20,
      },
    }
  },
  mocha: {
    timeout: 2000000
  },
};

export default config;
