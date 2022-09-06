pragma ton-solidity >=0.62.0;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./libraries/Gas.sol";
import "./libraries/DirectSellStatus.sol";
import "./libraries/ExchangePayload.sol";

import "./interfaces/IDirectSellCallback.sol";
import "./interfaces/IUpgradableByRequest.sol";

import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenRoot.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenWallet.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";

import "./Nft.sol";
import "./modules/TIP4_1/interfaces/ITIP4_1NFT.sol";

import "./errors/DirectBuySellErrors.sol";
import "./errors/BaseErrors.sol";

contract DirectSell is IAcceptTokensTransferCallback, IUpgradableByRequest {
  address static factoryDirectSell;
  address static owner;
  address static paymentToken;
  address static nftAddress;
  uint64 static timeTx;

  uint64 auctionStart;
  uint64 auctionEnd;

  uint128 price;

  address tokenWallet;
  uint8 currentStatus;
  uint32 currentVersion;

  struct DirectSellDetails {
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
    address sender;
  }

  event DirectSellStateChanged(uint8 from, uint8 to, DirectSellDetails);
  event DirectSellUpgrade();

  constructor(
    uint64 _auctionStart,
    uint64 _auctionEnd,
    uint128 _price
  ) public {
    if (msg.sender.value != 0 && msg.sender == factoryDirectSell) {
      changeState(DirectSellStatus.Create);
      tvm.rawReserve(Gas.DIRECT_SELL_INITIAL_BALANCE, 0);

      auctionStart = _auctionStart;
      auctionEnd = _auctionEnd;
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
    require(msg.sender.value != 0 && msg.sender == owner, DirectBuySellErrors.NOT_OWNER_DIRECT_BUY_SELL);
    _;
  }

  function getTypeContract() external pure returns (string) {
    return "DirectSell";
  }

  function onTokenWallet(address _wallet) external {
    require(msg.sender.value != 0 && msg.sender == paymentToken, DirectBuySellErrors.NOT_FROM_SPENT_TOKEN_ROOT);
    tokenWallet = _wallet;
    changeState(DirectSellStatus.Active);
  }

  function getDetails() external view returns (DirectSellDetails) {
    return builderDetails();
  }

  function onAcceptTokensTransfer(
    address, /*token_root*/
    uint128 amount,
    address sender,
    address, /*sender_wallet*/
    address original_gas_to,
    TvmCell payload
  ) external override {
    tvm.rawReserve(Gas.DIRECT_SELL_INITIAL_BALANCE, 0);

    (address buyer, uint32 callbackId) = ExchangePayload.getSenderAndCallId(sender, payload);
    TvmCell emptyPayload;

    if (
      msg.sender.value != 0 &&
      msg.sender == tokenWallet &&
      msg.value >= (Gas.DIRECT_SELL_INITIAL_BALANCE + Gas.DEPLOY_EMPTY_WALLET_VALUE) &&
      currentStatus == DirectSellStatus.Active &&
      amount >= price &&
      ((auctionEnd > 0 && now < auctionEnd) || auctionEnd == 0)
    ) {
      IDirectSellCallback(owner).directSellSuccess{ value: 0.1 ever, flag: 1, bounce: false }(callbackId, owner, buyer);
      changeState(DirectSellStatus.Filled);

      mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
      ITIP4_1NFT(nftAddress).transfer{ value: Gas.TRANSFER_OWNERSHIP_VALUE, flag: 1, bounce: false }(
        buyer,
        original_gas_to,
        callbacks
      );

      ITokenWallet(tokenWallet).transfer{ value: 0, flag: 128, bounce: false }(
        price,
        owner,
        Gas.DEPLOY_EMPTY_WALLET_GRAMS,
        original_gas_to,
        false,
        emptyPayload
      );
    } else {
      if (now >= auctionEnd) {
        IDirectSellCallback(owner).directSellCancelledOnTime{ value: 0.1 ever, flag: 1, bounce: false }(callbackId);
        changeState(DirectSellStatus.Filled);
      }

      ITokenWallet(msg.sender).transfer{ value: 0, flag: 128, bounce: false }(
        amount,
        buyer,
        uint128(0),
        original_gas_to,
        true,
        emptyPayload
      );
    }
  }

  function changeState(uint8 newState) private {
    uint8 prevStateN = currentStatus;
    currentStatus = newState;
    emit DirectSellStateChanged(prevStateN, newState, builderDetails());
  }

  function builderDetails() private view returns (DirectSellDetails) {
    return
      DirectSellDetails(
        factoryDirectSell,
        owner,
        paymentToken,
        nftAddress,
        timeTx,
        auctionStart,
        auctionEnd,
        price,
        tokenWallet,
        currentStatus,
        msg.sender
      );
  }

  function finishSell(address sendGasTo) public {
    require(currentStatus == DirectSellStatus.Active, DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS);
    require(now >= auctionEnd, DirectBuySellErrors.DIRECT_BUY_SELL_IN_STILL_PROGRESS);
    require(msg.value >= Gas.FINISH_ORDER_VALUE, BaseErrors.not_enough_value);

    changeState(DirectSellStatus.Expired);
    
    mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
    ITIP4_1NFT(nftAddress).changeManager{ value: 0, flag: 128 }(owner, sendGasTo, callbacks);
  }

  function closeSell() external onlyOwner {
    require(currentStatus == DirectSellStatus.Active, DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS);

    changeState(DirectSellStatus.Cancelled);

    mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
    ITIP4_1NFT(nftAddress).changeManager{ value: 0, flag: 128 }(owner, owner, callbacks);
  }

  function upgrade(
    TvmCell newCode,
    uint32 newVersion,
    address sendGasTo
  ) override external {
    require(msg.sender.value !=0 && msg.sender == factoryDirectSell, DirectBuySellErrors.NOT_FACTORY_DIRECT_SELL);
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
        auctionStart,
        auctionEnd,
        price,
        tokenWallet,
        currentStatus,
        currentVersion
      );
      
      tvm.setcode(newCode);
      tvm.setCurrentCode(newCode);

      onCodeUpgrade(cellParams);
    }
  }

  function onCodeUpgrade(TvmCell data) private {} 

}
