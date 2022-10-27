pragma ever-solidity >=0.62.0;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./errors/BaseErrors.sol";
import "./errors/DirectBuySellErrors.sol";

import "./libraries/Gas.sol";

import "./interfaces/IDirectSellCallback.sol";
import "./interfaces/IUpgradableByRequest.sol";

import "./modules/access/OwnableInternal.sol";
import "./modules/TIP4_1/interfaces/INftChangeManager.sol";
import "./modules/TIP4_1/interfaces/ITIP4_1NFT.sol";

import "./Nft.sol";
import "./DirectSell.sol";

contract FactoryDirectSell is OwnableInternal, INftChangeManager {
  uint64 static nonce_;
  
  TvmCell directSellCode;

  uint32 currentVersion;
  uint32 currectVersionDirectSell;

  event DirectSellDeployed(
    address directSell,
    address sender,
    address paymentToken,
    address nft,
    uint64  nonce,
    uint128 price
  );
  event DirectSellDeclined(address sender, address nft);
  event FactoryDirectSellUpgrade();

  constructor(address _owner, address sendGasTo) public OwnableInternal(_owner) {
    tvm.accept();
    tvm.rawReserve(Gas.DIRECT_SELL_INITIAL_BALANCE, 0);
    currentVersion++;

    _transferOwnership(_owner);
    sendGasTo.transfer({ value: 0, flag: 128, bounce: false });
  }

  function getTypeContract() external pure returns (string) {
    return "FactoryDirectSell";
  }

  function setCodeDirectSell(TvmCell _directSellCode) public onlyOwner {
    tvm.rawReserve(Gas.SET_CODE, 0);  
    directSellCode = _directSellCode;
    currectVersionDirectSell++;

    msg.sender.transfer(
      0,
		  false,
		  128 + 2
    );
  }

  function buildDirectSellCreationPayload(
    uint32 callbackId,
    address _nftAddress,
    uint64 _startTime,
    uint64 durationTime,
    address _paymentToken,
    uint128 _price
  ) external pure returns (TvmCell) {
    TvmBuilder builder;
    builder.store(callbackId);
    builder.store(_nftAddress);
    builder.store(_startTime);
    builder.store(durationTime);
    builder.store(_paymentToken);
    builder.store(_price);

    return builder.toCell();
  }

  function onNftChangeManager(
    uint256, /*id*/
    address nftOwner,
    address, /*oldManager*/
    address newManager,
    address, /*collection*/
    address sendGasTo,
    TvmCell payload
  ) external override {
    require(newManager == address(this), DirectBuySellErrors.NOT_NFT_MANAGER);
    tvm.rawReserve(Gas.DIRECT_BUY_INITIAL_BALANCE, 0);

    (, uint32 callbackId) = ExchangePayload.getSenderAndCallId(address(0), payload);
    TvmSlice payloadSlice = payload.toSlice();
    (,address nftForSell) = payloadSlice.decode(uint32, address);

    mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
    if (
      msg.sender.value != 0 && msg.sender == nftForSell &&
      msg.value >= (Gas.DEPLOY_DIRECT_SELL_MIN_VALUE + Gas.DEPLOY_EMPTY_WALLET_VALUE) &&
      payloadSlice.bits() == 523
    ) {
      (
        uint64 _startAuction, 
        uint64 durationTime, 
        address _paymentToken, 
        uint128 _price
      ) = payloadSlice.decode(
        uint64,
        uint64,
        address,
        uint128
      );
      uint64 _nonce = tx.timestamp;
      address directSell = new DirectSell{
        stateInit: _buildDirectSellStateInit(nftOwner, _paymentToken, nftForSell, _nonce),
        value: Gas.DEPLOY_DIRECT_SELL_MIN_VALUE
      }(_startAuction, durationTime, _price);

      emit DirectSellDeployed(
        directSell,
        msg.sender,
        _paymentToken,
        nftForSell,
        _nonce,
        _price
      );
      IDirectSellCallback(nftOwner).directSellDeployed{ 
        value: Gas.CALLBACK_VALUE, 
        flag: 1, 
        bounce: false 
      }(
        callbackId,
        directSell,
        msg.sender,
        _paymentToken,
        nftForSell,
        _nonce,
        _price
      );

      ITIP4_1NFT(msg.sender).changeManager{
        value: 0, 
        flag: 128 
      }(
        directSell, 
        sendGasTo, 
        callbacks
      );
    } else {
      emit DirectSellDeclined(msg.sender, nftForSell);
      IDirectSellCallback(nftOwner).directSellDeclined{
        value: Gas.CALLBACK_VALUE, 
        flag: 1,
        bounce: false
      }(
        callbackId,
        msg.sender,
        nftForSell
      );

      ITIP4_1NFT(msg.sender).changeManager{
        value: 0, 
        flag: 128 
      }(
        nftOwner, 
        sendGasTo, 
        callbacks
      );
    }
  }

  function _buildDirectSellStateInit(
    address _owner,
    address _paymentToken,
    address _nft,
    uint64 _timeTx
  ) private view returns (TvmCell) {
    return
      tvm.buildStateInit({
        contr: DirectSell,
        varInit: {
          factoryDirectSell: address(this),
          owner: _owner,
          paymentToken: _paymentToken,
          nftAddress: _nft,
          timeTx: _timeTx
        },
        code: directSellCode
      });
  }

  function expectedAddressDirectSell(
    address _owner,
    address _paymentToken,
    address _nft,
    uint64 _timeTx
  ) internal view returns (address) {
    return address(
        tvm.hash((_buildDirectSellStateInit(_owner, _paymentToken, _nft, _timeTx)))
      );
  }

  function RequestUpgradeDirectSell(
    address _owner, 
    address _paymentToken, 
    address _nft, 
    uint64 _timeTx, 
    address sendGasTo
  ) external view onlyOwner {
    require(msg.value >= Gas.UPGRADE_DIRECT_SELL_MIN_VALUE, BaseErrors.value_too_low);  
    tvm.rawReserve(math.max(
      Gas.DIRECT_SELL_INITIAL_BALANCE, 
      address(this).balance - msg.value), 2
    ); 

    IUpgradableByRequest(expectedAddressDirectSell(_owner, _paymentToken, _nft, _timeTx)).upgrade{
      value: 0,
      flag: 128
    }(
      directSellCode, 
      currectVersionDirectSell, 
      sendGasTo
    );      
  }

  function upgrade(
    TvmCell newCode,
    uint32 newVersion,
    address sendGasTo
  ) external onlyOwner {
    if (currentVersion == newVersion) {
			tvm.rawReserve(Gas.DIRECT_SELL_INITIAL_BALANCE, 0);
			sendGasTo.transfer({
				value: 0,
				flag: 128 + 2,
				bounce: false
			});
		} else {
      emit FactoryDirectSellUpgrade();

      TvmCell cellParams = abi.encode(
        nonce_,
        owner(),
        currentVersion,
        currectVersionDirectSell,
        directSellCode
      );
      
      tvm.setcode(newCode);
      tvm.setCurrentCode(newCode);

      onCodeUpgrade(cellParams);
    }  
  }

  function onCodeUpgrade(TvmCell data) private {}
}
