pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./errors/BaseErrors.sol";
import "./errors/DirectBuySellErrors.sol";

import "./libraries/Gas.sol";
import "./libraries/DirectSellStatus.sol";
import "./libraries/ExchangePayload.sol";

import "./interfaces/IDirectSellCallback.sol";
import "./interfaces/IUpgradableByRequest.sol";

import "./structures/IMarketFeeStructure.sol";

import "./modules/TIP4_1/interfaces/ITIP4_1NFT.sol";

import "./Nft.sol";

import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenRoot.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenWallet.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";


contract DirectSell is IAcceptTokensTransferCallback, IUpgradableByRequest, IMarketFeeStructure {
  address static factoryDirectSell;
  address static owner;
  address static paymentToken;
  address static nftAddress;
  uint64 static timeTx;

  uint64 startTime;
  uint64 durationTime;
  uint64 endTime;

  uint128 price;

  address tokenWallet;
  uint8 currentStatus;
  uint32 currentVersion;

  MarketFee fee;
  address weverVault;
  address weverRoot;

  struct DirectSellInfo {
    address factory;
    address creator;
    address token;
    address nft;
    uint64 _timeTx;
    uint64 start;
    uint64 end;
    uint128 _price;
    address wallet;
    uint8 status;
  }

  event DirectSellStateChanged(uint8 from, uint8 to, DirectSellInfo);
  event DirectSellUpgrade();
  event MarketFeeWithheld(uint128, address tokenRoot);

  constructor(
    uint64 _startTime,
    uint64 _durationTime,
    uint128 _price,
    MarketFee _fee,
    address _weverVault,
    address _weverRoot
  ) public
 {
    if (msg.sender.value != 0 && msg.sender == factoryDirectSell) {
      changeState(DirectSellStatus.Create);
      tvm.rawReserve(Gas.DIRECT_SELL_INITIAL_BALANCE, 0);
      fee = _fee;
      startTime = _startTime;
      durationTime = _durationTime;
      weverVault = _weverVault;
      weverRoot = _weverRoot;
      if(startTime > 0 && durationTime > 0) {
        endTime = startTime + durationTime;
      }
      price = _price;
      currentVersion++;

      ITokenRoot(paymentToken).deployWallet{
        value: Gas.DEPLOY_EMPTY_WALLET_VALUE,
        flag: 1,
        callback: DirectSell.onTokenWallet
      }(address(this), Gas.DEPLOY_EMPTY_WALLET_GRAMS);
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
    return "DirectSell";
  }

  function getMarketFee() external view returns (MarketFee) {
    return fee;
  }

  function setMarketFee(MarketFee _fee) external onlyFactory {
      require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
      fee= _fee;
  }

  modifier onlyFactory() virtual {
      require(msg.sender.value != 0 && msg.sender == factoryDirectSell, 100);
      _;
  }

  function onTokenWallet(address _wallet) external {
    require(
      msg.sender.value != 0 &&
      msg.sender == paymentToken,
      DirectBuySellErrors.NOT_FROM_SPENT_TOKEN_ROOT
    );
    tvm.rawReserve(Gas.DIRECT_SELL_INITIAL_BALANCE, 0);
    tokenWallet = _wallet;
    changeState(DirectSellStatus.Active);
  }

  function getInfo() external view returns (DirectSellInfo) {
    return buildInfo();
  }

  function onAcceptTokensTransfer(
    address, /*token_root*/
    uint128 amount,
    address sender,
    address, /*sender_wallet*/
    address originalGasTo,
    TvmCell payload
  ) external override {
    (
      address buyer,
      uint32 callbackId
    ) = ExchangePayload.getSenderAndCallId(sender, payload);

    TvmCell emptyPayload;
    mapping(address => ITIP4_1NFT.CallbackParams) callbacks;

    if (
      msg.sender.value != 0 &&
      msg.sender == tokenWallet &&
      msg.value >= (Gas.DIRECT_SELL_INITIAL_BALANCE + Gas.DEPLOY_EMPTY_WALLET_VALUE + Gas.FEE_VALUE) &&
      currentStatus == DirectSellStatus.Active &&
      amount >= price &&
      ((endTime > 0 && now < endTime) || endTime == 0) &&
      now >= startTime
    ) {
      tvm.rawReserve(Gas.DIRECT_SELL_INITIAL_BALANCE, 0);
      IDirectSellCallback(buyer).directSellSuccess{
        value: Gas.CALLBACK_VALUE,
        flag: 1,
        bounce: false
      }(
        callbackId,
        owner,
        buyer,
        nftAddress
      );

      uint128 currentFee = math.muldivc(price, fee.numerator, fee.denominator);
      uint128 balance = price - currentFee;

      changeState(DirectSellStatus.Filled);
      callbacks[buyer] = ITIP4_1NFT.CallbackParams(0.01 ever, emptyPayload);

      ITIP4_1NFT(nftAddress).transfer{
        value: Gas.TRANSFER_OWNERSHIP_VALUE,
        flag: 1,
        bounce: false
      }(
        buyer,
        originalGasTo,
        callbacks
      );

      _transfer(balance, owner, originalGasTo, tokenWallet, 0, 128, Gas.DEPLOY_EMPTY_WALLET_GRAMS);

      if (currentFee > 0) {
        emit MarketFeeWithheld(currentFee, paymentToken);
        ITokenWallet(tokenWallet).transfer{
          value: 0.5 ever,
          flag: 0,
          bounce: false
        }(
          currentFee,
          factoryDirectSell,
          Gas.DEPLOY_EMPTY_WALLET_GRAMS,
          originalGasTo,
          false,
          emptyPayload
        );
     }
    } else {
      if (endTime > 0 && now >= endTime) {
        IDirectSellCallback(buyer).directSellCancelledOnTime{
          value: Gas.CALLBACK_VALUE,
          flag: 1,
          bounce: false
        }(
          callbackId,
          nftAddress
        );

        changeState(DirectSellStatus.Expired);

        _transfer(amount, buyer, originalGasTo, msg.sender, 0.5 ever, 1, uint128(0));

        ITIP4_1NFT(nftAddress).changeManager{
          value: 0,
          flag: 128
        }(
          owner,
          originalGasTo,
          callbacks
        );
      } else {
        tvm.rawReserve(Gas.DIRECT_SELL_INITIAL_BALANCE, 0);
        IDirectSellCallback(buyer).directSellNotSuccess{
          value: Gas.CALLBACK_VALUE,
          flag: 1,
          bounce: false
        }(
          callbackId,
          nftAddress
        );
        _transfer(amount, buyer, originalGasTo, msg.sender, 0, 128, uint128(0));
      }
    }
  }

  function _transfer(uint128 amount, address user, address remainingGasTo, address sender, uint128 value, uint16 flag, uint128 gas) private {
        TvmCell emptyPayload;
        if (paymentToken == weverRoot) {
            ITokenWallet(sender).transfer{ value: value, flag: flag, bounce: false }(
                amount,
                weverVault,
                uint128(0),
                user,
                true,
                emptyPayload
            );
        } else {
            ITokenWallet(sender).transfer{ value: value, flag: flag, bounce: false }(
                amount,
                user,
                gas,
                remainingGasTo,
                true,
                emptyPayload
            );
        }
    }

  function changeState(uint8 newState) private {
    uint8 prevStateN = currentStatus;
    currentStatus = newState;
    emit DirectSellStateChanged(prevStateN, newState, buildInfo());
  }

  function buildInfo() private view returns (DirectSellInfo) {
    return
      DirectSellInfo(
        factoryDirectSell,
        owner,
        paymentToken,
        nftAddress,
        timeTx,
        startTime,
        endTime,
        price,
        tokenWallet,
        currentStatus
      );
  }

  function finishSell(address sendGasTo, uint32 callbackId) public {
    require(
      currentStatus == DirectSellStatus.Active,
      DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS
    );

    require(
      now >= endTime,
      DirectBuySellErrors.DIRECT_BUY_SELL_IN_STILL_PROGRESS
    );

    require(
      msg.value >= Gas.FINISH_ORDER_VALUE,
      BaseErrors.not_enough_value
    );

    IDirectSellCallback(msg.sender).directSellCancelledOnTime{
      value: Gas.CALLBACK_VALUE,
      flag: 1,
      bounce: false
    }(
      callbackId,
      nftAddress
    );
    changeState(DirectSellStatus.Expired);

    mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
    ITIP4_1NFT(nftAddress).changeManager{
      value: 0,
      flag: 128
    }(
      owner,
      sendGasTo,
      callbacks
    );
  }

  function closeSell(uint32 callbackId) external onlyOwner {
    require(
      currentStatus == DirectSellStatus.Active,
      DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS
    );
    IDirectSellCallback(owner).directSellClose{
      value: Gas.CALLBACK_VALUE,
      flag: 1,
      bounce: false
    }(
      callbackId,
      nftAddress
    );
    changeState(DirectSellStatus.Cancelled);

    mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
    ITIP4_1NFT(nftAddress).changeManager{
      value: 0,
      flag: 128
    }(
      owner,
      owner,
      callbacks
    );
  }

  function upgrade(
    TvmCell newCode,
    uint32 newVersion,
    address sendGasTo
  ) override external {
    require(
      msg.sender.value != 0 &&
      msg.sender == factoryDirectSell,
      DirectBuySellErrors.NOT_FACTORY_DIRECT_SELL
    );

    if (currentVersion == newVersion) {
			tvm.rawReserve(Gas.DIRECT_BUY_INITIAL_BALANCE, 0);
			sendGasTo.transfer({
				value: 0,
				flag: 128 + 2,
				bounce: false
			});
		} else {
      emit DirectSellUpgrade();

      TvmCell cellParams = abi.encode(
        factoryDirectSell,
        owner,
        paymentToken,
        nftAddress,
        timeTx,
        startTime,
        durationTime,
        endTime,
        price,
        tokenWallet,
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
