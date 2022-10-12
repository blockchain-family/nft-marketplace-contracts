pragma ever-solidity >=0.62.0;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./errors/BaseErrors.sol";

import "./libraries/Gas.sol";

import "./interfaces/IDirectBuyCallback.sol";
import "./interfaces/IUpgradableByRequest.sol";

import "./modules/access/OwnableInternal.sol";

import "./DirectBuy.sol";

import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenWallet.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "ton-eth-bridge-token-contracts/contracts/TokenWalletPlatform.sol";

contract FactoryDirectBuy is IAcceptTokensTransferCallback, OwnableInternal {
  uint64 static nonce_;

  TvmCell tokenPlatformCode;
  TvmCell directBuyCode;

  uint32 currentVersion;
  uint32 currectVersionDirectBuy;

  event DirectBuyDeployed(
    address directBuyAddress,
    address sender,
    address token,
    address nft,
    uint64 nonce,
    uint128 amount
  );

  event DirectBuyDeclined(address sender, address token, uint128 amount);
  event FactoryDirectBuyUpgrade();

  constructor(address _owner, address sendGasTo) OwnableInternal(_owner) public {
    tvm.accept();
    tvm.rawReserve(Gas.DIRECT_BUY_INITIAL_BALANCE, 0);
    currentVersion++;

    _transferOwnership(_owner);
    sendGasTo.transfer({ value: 0, flag: 128, bounce: false });
  }

  function getTypeContract() external pure returns (string) {
    return "FactoryDirectBuy";
  }

  function buildDirectBuyCreationPayload(
    uint32 callbackId,
    address nft,
    uint64 startTime,
    uint64 durationTime
  ) external pure returns (TvmCell) {
    TvmBuilder builder;
    builder.store(callbackId);
    builder.store(nft);
    builder.store(startTime);
    builder.store(durationTime);
    
    return builder.toCell();
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
    currectVersionDirectBuy++;

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
    
    (address buyer, uint32 callbackId) = ExchangePayload.getSenderAndCallId(sender, payload); 
    
    TvmSlice payloadSlice = payload.toSlice();
    (,address nftForBuy) = payloadSlice.decode(uint32, address);
  
    if (
      payloadSlice.bits() == 128 &&
      msg.sender.value != 0 &&
      msg.sender == getTokenWallet(tokenRoot, address(this)) &&
      msg.value >= (Gas.DEPLOY_DIRECT_BUY_MIN_VALUE + Gas.DEPLOY_EMPTY_WALLET_VALUE)
    ) {
      (uint64 startTime, uint64 durationTime) = payloadSlice.decode(uint64, uint64);
      uint64 nonce = tx.timestamp;

      TvmCell stateInit = _buildDirectBuyStateInit(buyer, tokenRoot, nftForBuy, nonce);
      address directBuyAddress = address(tvm.hash(stateInit));

      new DirectBuy{ stateInit: stateInit, value: Gas.DEPLOY_DIRECT_BUY_MIN_VALUE }(
        amount,
        startTime,
        durationTime,
        getTokenWallet(tokenRoot, directBuyAddress)
      );

      emit DirectBuyDeployed(directBuyAddress, buyer, tokenRoot, nftForBuy, nonce, amount);
      IDirectBuyCallback(buyer).directBuyDeployed{ 
        value: 0.1 ever, 
        flag: 1, 
        bounce: false 
      }(
        callbackId, 
        directBuyAddress, 
        buyer, 
        tokenRoot, 
        nftForBuy, 
        nonce, 
        amount
      );

      ITokenWallet(msg.sender).transfer{ 
        value: 0, 
        flag: 128, 
        bounce: false 
      }(
        amount,
        directBuyAddress,
        Gas.DEPLOY_EMPTY_WALLET_GRAMS,
        originalGasTo,
        true,
        payload
      );
    } else {
      emit DirectBuyDeclined(buyer, tokenRoot, amount);
      IDirectBuyCallback(buyer).directBuyDeployedDeclined{ 
        value: 0.1 ever, 
        flag: 1, 
        bounce: false 
      }(
        callbackId, 
        buyer, 
        tokenRoot, 
        amount
      );

      TvmCell emptyPayload;
      ITokenWallet(msg.sender).transfer{ 
        value: 0, 
        flag: 128, 
        bounce: false
      }(
        amount,
        buyer,
        uint128(0),
        originalGasTo,
        true,
        emptyPayload
      );
    }
  }

  function _buildDirectBuyStateInit(
    address _owner,
    address _spentToken,
    address _nft,
    uint64 _timeTx
  ) private view returns (TvmCell) {
    return
      tvm.buildStateInit({
        contr: DirectBuy,
        varInit: {
          factoryDirectBuy: address(this),
          owner: _owner,
          spentToken: _spentToken,
          nftAddress: _nft,
          timeTx: _timeTx
        },
        code: directBuyCode
      });
  }

  function getTokenWallet(
    address token, 
    address _sender
  ) internal view returns (address) {
    return
      address(
        tvm.hash(
          tvm.buildStateInit({
            contr: TokenWalletPlatform,
            varInit: { root: token, owner: _sender },
            code: tokenPlatformCode
          })
        )
      );
  }

  function expectedAddressDirectBuy(
    address _owner,
    address spentToken,
    address _nft,
    uint64 _timeTx
  ) internal view returns (address) {
    return address(
        tvm.hash((_buildDirectBuyStateInit(_owner, spentToken, _nft, _timeTx)))
      );
  }

  function RequestUpgradeDirectSell(
    address _owner,
    address spentToken, 
    address _nft, 
    uint64 _timeTx, 
    address sendGasTo
  ) external view onlyOwner {
    require(msg.value >= Gas.UPGRADE_DIRECT_BUY_MIN_VALUE, BaseErrors.value_too_low);  
    tvm.rawReserve(math.max(
      Gas.DIRECT_BUY_INITIAL_BALANCE, 
      address(this).balance - msg.value), 2
    );
    
    IUpgradableByRequest(expectedAddressDirectBuy(_owner, spentToken, _nft, _timeTx)).upgrade{
      value: 0,
      flag: 128
    }(
      directBuyCode, 
      currectVersionDirectBuy, 
      sendGasTo
    );      

  }

  function upgrade (
    TvmCell newCode,
    uint32 newVersion,
    address sendGasTo
  ) external onlyOwner {
     if (currentVersion == newVersion) {
			tvm.rawReserve(Gas.DIRECT_BUY_INITIAL_BALANCE, 0);
			sendGasTo.transfer({
				value: 0,
				flag: 128 + 2,
				bounce: false
			});
		} else {
      emit FactoryDirectBuyUpgrade();

      TvmCell cellParams = abi.encode(
        nonce_,
        owner(),
        currentVersion,
        tokenPlatformCode,
        directBuyCode
      );
            
      tvm.setcode(newCode);
      tvm.setCurrentCode(newCode);

      onCodeUpgrade(cellParams);
    }
  }

  function onCodeUpgrade(TvmCell data) private {}
}

