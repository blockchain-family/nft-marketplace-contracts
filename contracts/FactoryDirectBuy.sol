pragma ton-solidity >=0.62.0;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./libraries/Gas.sol";

import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenWallet.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "ton-eth-bridge-token-contracts/contracts/TokenWalletPlatform.sol";

import "./interfaces/IDirectBuyCallback.sol";
import "./modules/access/OwnableInternal.sol";

import "./DirectBuy.sol";

contract FactoryDirectBuy is IAcceptTokensTransferCallback, OwnableInternal {
  uint64 static nonce_;

  TvmCell tokenPlatformCode;
  TvmCell directBuyCode;

  event DirectBuyDeployed(
    address directBuyAddress,
    address sender,
    address tokenRoot,
    address nft,
    uint64 nonce,
    uint128 amount
  );

  event DirectBuyDeclined(address sender, address tokenRoot, uint128 amount);

  constructor(address _owner, address sendGasTo) OwnableInternal(_owner) public {
    tvm.accept();
    tvm.rawReserve(Gas.DIRECT_BUY_INITIAL_BALANCE, 0);

    _transferOwnership(_owner);
    sendGasTo.transfer({ value: 0, flag: 128, bounce: false });
  }

  function getTypeContract() external pure returns (string) {
    return "FactoryDirectBuy";
  }

  function buildPayload(
    address nft,
    uint64 startTime,
    uint64 durationTime
  ) external pure returns (TvmCell) {
    return abi.encode(nft, startTime, durationTime);
  }

  function setCodeTokenPlatform(TvmCell _tokenPlatformCode) public onlyOwner {
    tvm.rawReserve(Gas.SET_CODE, 0);
    tokenPlatformCode = _tokenPlatformCode;

    msg.sender.transfer(
      0,
		  false,
		  128 + 2
    );
  } 

  function setCodeDirectBuy(TvmCell _directBuyCode) public onlyOwner {
    tvm.rawReserve(Gas.SET_CODE, 0);  
    directBuyCode = _directBuyCode;

    msg.sender.transfer(
      0,
		  false,
		  128 + 2
    );
  }

  function onAcceptTokensTransfer(
    address tokenRoot,
    uint128 amount,
    address sender,
    address, /*senderWallet*/
    address originalGasTo,
    TvmCell payload
  ) override external {
    tvm.rawReserve(Gas.DEPLOY_DIRECT_BUY_MIN_VALUE, 0);

    TvmSlice payloadSlice = payload.toSlice();
    address nftForBuy = payloadSlice.decode(address);
    if (
      payloadSlice.bits() == 128 &&
      msg.sender.value != 0 &&
      msg.sender == getTokenWallet(tokenRoot, address(this)) &&
      msg.value >= (Gas.DEPLOY_DIRECT_BUY_MIN_VALUE + Gas.DEPLOY_EMPTY_WALLET_VALUE)
    ) {
      (uint64 startTime, uint64 durationTime) = payloadSlice.decode(uint64, uint64);
      uint64 nonce = tx.timestamp;

      TvmCell stateInit = _buildDirectBuyStateInit(sender, tokenRoot, nftForBuy, nonce);
      address directBuyAddress = address(tvm.hash(stateInit));

      new DirectBuy{ stateInit: stateInit, value: Gas.DEPLOY_DIRECT_BUY_MIN_VALUE }(
        amount,
        startTime,
        durationTime,
        getTokenWallet(tokenRoot, directBuyAddress)
      );

      emit DirectBuyDeployed{dest: address.makeAddrExtern(nftForBuy.value, 256)}(directBuyAddress, sender, tokenRoot, nftForBuy, nonce, amount);
      emit DirectBuyDeployed{dest: address.makeAddrExtern(sender.value, 256)}(directBuyAddress, sender, tokenRoot, nftForBuy, nonce, amount);
      IDirectBuyCallback(sender).directBuyDeployed(directBuyAddress, sender, tokenRoot, nftForBuy, nonce, amount);

      ITokenWallet(msg.sender).transfer{ value: 0, flag: 128, bounce: false }(
        amount,
        directBuyAddress,
        Gas.DEPLOY_EMPTY_WALLET_GRAMS,
        originalGasTo,
        true,
        payload
      );
    } else {
      emit DirectBuyDeclined{dest: address.makeAddrExtern(nftForBuy.value, 256)}(sender, tokenRoot, amount);
      emit DirectBuyDeclined{dest: address.makeAddrExtern(sender.value, 256)}(sender, tokenRoot, amount);
      IDirectBuyCallback(sender).directBuyDeployedDeclined(sender, tokenRoot, amount);

      TvmCell emptyPayload;
      ITokenWallet(msg.sender).transfer{ value: 0, flag: 128, bounce: false }(
        amount,
        sender,
        uint128(0),
        originalGasTo,
        true,
        emptyPayload
      );
    }
  }

  function _buildDirectBuyStateInit(
    address _owner,
    address _spentTokenRoot,
    address _nft,
    uint64 _timeTx
  ) private view returns (TvmCell) {
    return
      tvm.buildStateInit({
        contr: DirectBuy,
        varInit: {
          factoryDirectBuy: address(this),
          owner: _owner,
          spentTokenRoot: _spentTokenRoot,
          nftAddress: _nft,
          timeTx: _timeTx
        },
        code: directBuyCode
      });
  }

  function expectedAddressDirectBuy(
    address _owner,
    address _spentTokenRoot,
    address _nft,
    uint64 _timeTx
  ) external view responsible returns (address) {
    return
      { value: 0, bounce: false, flag: 64 } address(
        tvm.hash((_buildDirectBuyStateInit(_owner, _spentTokenRoot, _nft, _timeTx)))
      );
  }

  function getTokenWallet(address _tokenRoot, address _sender) internal view returns (address) {
    return
      address(
        tvm.hash(
          tvm.buildStateInit({
            contr: TokenWalletPlatform,
            varInit: { root: _tokenRoot, owner: _sender },
            code: tokenPlatformCode
          })
        )
      );
  }
}
