pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./errors/BaseErrors.sol";
import "./errors/DirectBuySellErrors.sol";

import "./libraries/Gas.sol";
import "./libraries/DirectBuyStatus.sol";
import "./libraries/ExchangePayload.sol";

import "./interfaces/IDirectBuyCallback.sol";
import "./interfaces/IUpgradableByRequest.sol";

import "./modules/TIP4_1/interfaces/INftChangeManager.sol";
import "./modules/TIP4_1/interfaces/ITIP4_1NFT.sol";

import "./Nft.sol";

import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenRoot.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenWallet.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "./structures/IMarketFeeStructure.sol";

contract DirectBuy is IAcceptTokensTransferCallback, INftChangeManager, IUpgradableByRequest, IMarketFeeStructure {
  address static factoryDirectBuy;
  address static owner;
  address static spentToken;
  address static nftAddress;
  uint64 static timeTx;

  uint128 price;

  uint64 startTime;
  uint64 durationTime;
  uint64 endTime;

  address spentTokenWallet;
  uint8 currentStatus;
  uint32 currentVersion;

  MarketFee fee;

  struct DirectBuyInfo {
    address factory;
    address creator;
    address spentToken;
    address nft;
    uint64 _timeTx;
    uint128 _price;
    address spentWallet;
    uint8 status;
    uint64 startTimeBuy;
    uint64 durationTimeBuy;
    uint64 endTimeBuy;
  }

  event DirectBuyStateChanged(uint8 from, uint8 to, DirectBuyInfo);
  event DirectBuyUpgrade();
  event MarketFeeWithheld(uint128 amount, address tokenRoot);

  constructor(
    uint128 _amount,
    uint64 _startTime,
    uint64 _durationTime,
    address _spentTokenWallet,
    MarketFee _fee
  ) public {
    if (msg.sender.value != 0 && msg.sender == factoryDirectBuy) {
      changeState(DirectBuyStatus.Create);
      tvm.rawReserve(Gas.DIRECT_BUY_INITIAL_BALANCE, 0);
      price = _amount;
      startTime = _startTime;
      durationTime = _durationTime;
      if (_startTime > 0 && _durationTime > 0) {
        endTime = _startTime + _durationTime;
      }
      spentTokenWallet = _spentTokenWallet;
      fee = _fee;
      currentVersion++;
    } else {
      msg.sender.transfer(0, false, 128 + 32);
    }
  }

  modifier onlyOwner() {
    require(
      msg.sender.value != 0 &&
      msg.sender == owner,
      DirectBuySellErrors.NOT_OWNER_DIRECT_BUY_SELL
    );
    _;
  }

  function getTypeContract() external pure returns (string) {
    return "DirectBuy";
  }

  function getMarketFee() external view returns (MarketFee) {
    return fee;
  }

  function setMarketFee(MarketFee _fee) external onlyFactory {
      require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
      fee= _fee;
  }

  modifier onlyFactory() virtual {
      require(msg.sender.value != 0 && msg.sender == factoryDirectBuy, 100);
      _;
  }

  function getInfo() external view returns (DirectBuyInfo) {
    return buildInfo();
  }

  function onAcceptTokensTransfer(
    address tokenRoot,
    uint128 amount,
    address sender,
    address, /*senderWallet*/
    address originalGasTo,
    TvmCell /*payload*/
  ) external override {
    tvm.rawReserve(Gas.DIRECT_BUY_INITIAL_BALANCE, 0);
    if (
        tokenRoot == spentToken &&
        msg.sender.value != 0 &&
        msg.sender == spentTokenWallet &&
        amount >= price &&
        sender == factoryDirectBuy
    ) {
      changeState(DirectBuyStatus.Active);
    } else {
      TvmCell emptyPayload;
      ITokenWallet(msg.sender).transfer{
        value: 0,
        flag: 128,
        bounce: false
      }(
        amount,
        sender,
        uint128(0),
        originalGasTo,
        true,
        emptyPayload
      );
    }
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
    (, uint32 callbackId) = ExchangePayload.getSenderAndCallId(address(0), payload);
    mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
    if (
        msg.sender.value != 0 &&
        msg.sender == nftAddress &&
        msg.value >= (Gas.DIRECT_BUY_INITIAL_BALANCE + Gas.DEPLOY_EMPTY_WALLET_VALUE + Gas.FEE_VALUE) &&
        currentStatus == DirectBuyStatus.Active &&
        ((endTime > 0 && now < endTime) || endTime == 0) &&
        now >= startTime
    ) {

      uint128 currentFee = math.muldivc(price, fee.numerator, fee.denominator);
      uint128 balance = price - currentFee;

      IDirectBuyCallback(nftOwner).directBuySuccess{
        value: Gas.CALLBACK_VALUE,
        flag: 1,
        bounce: false
      }(
        callbackId,
        nftOwner,
        owner,
        nftAddress
      );

      changeState(DirectBuyStatus.Filled);

      TvmCell empty;
      callbacks[owner] = ITIP4_1NFT.CallbackParams(0.01 ever, empty);

      ITIP4_1NFT(nftAddress).transfer{
        value: Gas.TRANSFER_OWNERSHIP_VALUE,
        flag: 1,
        bounce: false
      }(
        owner,
        sendGasTo,
        callbacks
      );

      ITokenWallet(spentTokenWallet).transfer{
        value: 0,
        flag: 128,
        bounce: false
      }(
        balance,
        nftOwner,
        Gas.DEPLOY_EMPTY_WALLET_GRAMS,
        sendGasTo,
        false,
        empty
      );
      if (currentFee > 0) {
        emit MarketFeeWithheld(currentFee, spentToken);
        ITokenWallet(spentTokenWallet).transfer{
          value: 0.5 ever,
          flag: 0,
          bounce: false
        }(
          currentFee,
          factoryDirectBuy,
          Gas.DEPLOY_EMPTY_WALLET_GRAMS,
          sendGasTo,
          false,
          empty
        );
      }

    } else {
      if (endTime > 0 && now >= endTime && currentStatus == DirectBuyStatus.Active) {
        IDirectBuyCallback(nftOwner).directBuyCancelledOnTime{
          value: Gas.CALLBACK_VALUE,
          flag: 1,
          bounce: false
        }(
          callbackId,
          nftAddress
        );

        changeState(DirectBuyStatus.Expired);
        ITIP4_1NFT(msg.sender).changeManager{
          value: 0,
          flag: 64
        }(
          nftOwner,
          sendGasTo,
          callbacks
        );

        TvmCell emptyPayload;
        ITokenWallet(spentTokenWallet).transfer{
          value: 0,
          flag: 128,
          bounce: false
        }(
          price,
          owner,
          0,
          sendGasTo,
          true,
          emptyPayload
        );
      } else {
        tvm.rawReserve(Gas.DIRECT_BUY_INITIAL_BALANCE, 0);

        IDirectBuyCallback(nftOwner).directBuyNotSuccess{
          value: Gas.CALLBACK_VALUE,
          flag: 1,
          bounce: false
        }(
          callbackId,
          nftAddress
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
  }

  function changeState(uint8 newState) private {
    uint8 prevStateN = currentStatus;
    currentStatus = newState;
    emit DirectBuyStateChanged(prevStateN, newState, buildInfo());
  }

  function buildInfo() private view returns (DirectBuyInfo) {
    return
      DirectBuyInfo(
        factoryDirectBuy,
        owner,
        spentToken,
        nftAddress,
        timeTx,
        price,
        spentTokenWallet,
        currentStatus,
        startTime,
        durationTime,
        endTime
      );
  }

  function finishBuy(address sendGasTo, uint32 callbackId) public {
    require(
      currentStatus == DirectBuyStatus.Active,
      DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS
    );
    require(now >= endTime, DirectBuySellErrors.DIRECT_BUY_SELL_IN_STILL_PROGRESS);
    require(msg.value >= Gas.FINISH_ORDER_VALUE, BaseErrors.not_enough_value);

    IDirectBuyCallback(msg.sender).directBuyCancelledOnTime{
      value: Gas.CALLBACK_VALUE,
      flag: 1,
      bounce: false
    }(
      callbackId,
      nftAddress
    );
    changeState(DirectBuyStatus.Expired);

    TvmCell emptyPayload;
    ITokenWallet(spentTokenWallet).transfer{
      value: 0,
      flag: 128,
      bounce: false
    }(
      price,
      owner,
      0,
      sendGasTo,
      true,
      emptyPayload
    );
  }

  function closeBuy(uint32 callbackId) external onlyOwner {
    require(
      currentStatus == DirectBuyStatus.Active,
      DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS
    );

    IDirectBuyCallback(owner).directBuyClose{
      value: Gas.CALLBACK_VALUE,
      flag: 1,
      bounce: false
    }(
      callbackId,
      nftAddress
    );
    changeState(DirectBuyStatus.Cancelled);

    TvmCell emptyPayload;
    ITokenWallet(spentTokenWallet).transfer{
      value: 0,
      flag: 128,
      bounce: false
    }(
      price,
      owner,
      0,
      owner,
      true,
      emptyPayload
    );
  }

  function upgrade(
    TvmCell newCode,
    uint32 newVersion,
    address sendGasTo
  ) override external {
    require(
      msg.sender.value != 0 &&
      msg.sender == factoryDirectBuy,
      DirectBuySellErrors.NOT_FACTORY_DIRECT_BUY
    );

    if (currentVersion == newVersion) {
			tvm.rawReserve(Gas.DIRECT_BUY_INITIAL_BALANCE, 0);
			sendGasTo.transfer({
				value: 0,
				flag: 128 + 2,
				bounce: false
			});
		} else {
      emit DirectBuyUpgrade();

      TvmCell cellParams = abi.encode(
        factoryDirectBuy,
        owner,
        spentToken,
        nftAddress,
        timeTx,
        price,
        startTime,
        durationTime,
        endTime,
        spentTokenWallet,
        currentStatus,
        currentVersion,
        fee
      );

      tvm.setcode(newCode);
      tvm.setCurrentCode(newCode);

      onCodeUpgrade(cellParams);
    }
  }

  function onCodeUpgrade(TvmCell data) private {}
}
