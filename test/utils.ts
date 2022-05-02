import BigNumber from "bignumber.js";
const logger = require('mocha-logger');

declare var locklift: LockLift;

export type Address = `0:${string}`
export const isValidTonAddress = (address: string): address is Address => /^(?:-1|0):[0-9a-fA-F]{64}$/.test(address);

export interface LockLift {
  network: string,
  factory: { getContract: (contract: string, build?: string) => Promise<Contract>, getAccount: (type: string) => Promise<Account> },
  keys: { getKeyPairs: () => Promise<KeyPair[]> },
  utils: { convertCrystal: (balance: number | `${number}`, type: 'nano' | string) => string, zeroAddress: Address },
  ton: { getBalance: (address: Address) => Promise<BigNumber> }
  giver: Giver
}

export interface KeyPair { public: string, secret: string }
export interface Contract {
  name: string,
  address: Address,
  keyPair: KeyPair,
  code: string,
  abi: string,
  setAddress: (address: Address) => void;
  call: (opts: { method: string, params: any }) => Promise<any>,
};

export interface Giver {
  locklift: LockLift,
  giver: Account,
  deployContract: (opts: { contract: Contract, constructorParams: any, initParams: any, keyPair?: KeyPair }, value?: string) => Promise<Contract>
}

export interface Account extends Contract {
  setKeyPair: (keyPair: KeyPair) => void,
  deployContract: (opts: { contract: Contract, constructorParams: any, initParams: any, keyPair: KeyPair }, value?: string) => Promise<Contract>,
  runTarget: (opts: { contract: Contract, method: string, params: any, keyPair: KeyPair, value: string }) => Promise<Tx>,
  run: (opts: { method: string, params: any, keyPair?: KeyPair }) => Promise<Tx>
}

export interface Tx {
  transaction: {
    json_version: number,
    id: string,
    boc: string,
    status: number,
    status_name: string,
    storage: {
      storage_fees_collected: string,
      status_change: number,
      status_change_name: string
    },
    action: {
      success: boolean,
      valid: boolean,
      no_funds: boolean,
      result_code: number,
    },
    now: number,
    in_msg: string,
    out_msgs: string[],
    account_addr: string,
    old_hash: string,
    new_hash: string,
  },
  out_messages: string[],
}

export const getRandomNonce = () => Math.random() * 64000 | 0;

export async function logContract(contract: Contract) {
  const balance = await locklift.ton.getBalance(contract.address);
  logger.log(`${contract.name} (${contract.address}) - ${locklift.utils.convertCrystal(balance.toNumber(), 'ton')}`);
};

export async function getAccount(keyPair: KeyPair, address: Address) {
  const account = await locklift.factory.getAccount("Wallet")
  account.setKeyPair(keyPair)
  account.setAddress(address)
  return account;
}

export async function deployAccount(keyPair: KeyPair, balance: number): Promise<Account> {
  const account = await locklift.factory.getAccount("Wallet");

  await locklift.giver.deployContract({
    contract: account,
    constructorParams: {},
    initParams: {
      _randomNonce: Math.random() * 6400 | 0,
    },
    keyPair,
  }, locklift.utils.convertCrystal(balance, 'nano'));

  account.setKeyPair(keyPair);

  return account;
}

export async function deployTokenRoot(account: Account, config: { name: string, symbol: string, decimals: string, initialSupply?: string, deployWalletValue?: string }): Promise<Contract> {
  let { name, symbol, decimals, initialSupply, deployWalletValue } = config;
  decimals = decimals || '4'
  initialSupply = initialSupply || new BigNumber(10000000).shiftedBy(2).toFixed()
  // deployWalletValue = deployWalletValue || locklift.utils.convertCrystal('1', 'nano')
  deployWalletValue = locklift.utils.convertCrystal('0.1', 'nano')

  const TokenRoot = await locklift.factory.getContract("TokenRoot");
  const TokenWallet = await locklift.factory.getContract("TokenWallet");

  return await locklift.giver.deployContract({
    contract: TokenRoot,
    constructorParams: {
      initialSupplyTo: account.address,
      initialSupply,
      deployWalletValue,
      mintDisabled: false,
      burnByRootDisabled: false,
      burnPaused: false,
      remainingGasTo: locklift.utils.zeroAddress
    },
    initParams: {
      deployer_: locklift.utils.zeroAddress,
      randomNonce_: getRandomNonce(),
      rootOwner_: account.address,
      name_: name,
      symbol_: symbol,
      decimals_: decimals,
      walletCode_: TokenWallet.code,
    },
    keyPair: account.keyPair,
  }, locklift.utils.convertCrystal('3', 'nano'));

}

export async function deployCollection(account: Account, config = {remainOnNft: 1}): Promise<Contract> {
  const Collection = await locklift.factory.getContract("Collection");
  const Nft = await locklift.factory.getContract("Nft");
  const Index = await locklift.factory.getContract("Index", 'precompiled');
  const IndexBasis = await locklift.factory.getContract("IndexBasis");

  let { remainOnNft } = config;
  remainOnNft = remainOnNft || 0;

  return await locklift.giver.deployContract({
    contract: Collection,
    constructorParams: {
      codeNft: Nft.code,
      codeIndex: Index.code,
      codeIndexBasis: IndexBasis.code,
      owner: account.address,
      remainOnNft: locklift.utils.convertCrystal(remainOnNft, 'nano'),
    },
    initParams: {},
    keyPair: account.keyPair,
  }, locklift.utils.convertCrystal(4, 'nano'));
}

export async function deployTokenWallet(account: Account, tokenRoot: Contract): Promise<Contract> {

  let walletAddr = await tokenRoot.call({
    method: 'walletOf',
    params: {
      walletOwner: account.address,
      answerId: 0
    }
  });

  await account.runTarget({
    contract: tokenRoot,
    method: 'deployWallet',
    params: {
      walletOwner: account.address,
      deployWalletValue: locklift.utils.convertCrystal(0.1, 'nano'),
      answerId: 0
    },
    keyPair: account.keyPair,
    value: locklift.utils.convertCrystal(0.5, 'nano'),
  });

  const TokenWallet = await locklift.factory.getContract("TokenWallet");
  TokenWallet.setAddress(walletAddr);

  return TokenWallet;
}

export function getTotalSupply(market: Contract): Promise<BigNumber> {
  return market.call({
    method: 'totalSupply',
    params: {
      answerId: 0
    }
  });
}

export function getPurchaseCount(market: Contract): Promise<BigNumber> {
  return market.call({
    method: 'purchaseCount',
    params: {
      answerId: 0
    }
  });
}

export async function getTokenWallet(market: Contract): Promise<Contract> {
  const tokenWallet = await locklift.factory.getContract("TokenWallet");
  let walletAddr = await market.call({
    method: 'tokenWallet',
    params: {
      answerId: 0
    }
  });

  tokenWallet.setAddress(walletAddr);

  return tokenWallet;
}

export async function getNftById(market: Contract, id: number): Promise<Contract> {
  let nft = await locklift.factory.getContract("Nft");
  let nftAddr = await market.call({
    method: 'nftAddress',
    params: { id, answerId: 0 }
  });

  nft.setAddress(nftAddr);

  return nft;
}

