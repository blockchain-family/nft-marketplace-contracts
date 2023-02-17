pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./errors/BaseErrors.sol";
import "./errors/DirectBuySellErrors.sol";

import "./libraries/Gas.sol";
import "./libraries/DirectSellStatus.sol";

import "./interfaces/IDirectSellCallback.sol";
import "./interfaces/IUpgradableByRequest.sol";

import "./structures/IMarketFeeStructure.sol";
import "./structures/IDirectSellGasValuesStructure.sol";

import "./modules/TIP4_1/interfaces/ITIP4_1NFT.sol";
import "./modules/TIP4_1/structures/ICallbackParamsStructure.sol";
import "./structures/IGasValueStructure.sol";

import "./Nft.sol";

import "tip3/contracts/interfaces/ITokenRoot.sol";
import "tip3/contracts/interfaces/ITokenWallet.sol";
import "tip3/contracts/interfaces/IAcceptTokensTransferCallback.sol";



contract DirectSell is IAcceptTokensTransferCallback, IUpgradableByRequest, IMarketFeeStructure, IDirectSellGasValuesStructure, ICallbackParamsStructure, IGasValueStructure {
    address static factoryDirectSell;
    address static owner;
    address static paymentToken;
    address static nftAddress;
    uint64 static timeTx;

    DirectSellGasValues directSellGas;

    uint64 startTime;
    uint64 durationTime;
    uint64 endTime;

    uint128 price;

    address tokenWallet;
    uint8 currentStatus;
    uint32 currentVersion;

    MarketFee fee;
    address public weverVault;
    address public weverRoot;

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
        address _weverRoot,
        DirectSellGasValues _directSellGas
    ) public
    {
        if (
            msg.sender.value != 0 &&
            msg.sender == factoryDirectSell &&
            msg.sender.value >= calcValue(_directSellGas.deployWallet)
        ){
            _reserve();
            changeState(DirectSellStatus.Create);
            fee = _fee;
            startTime = _startTime;
            durationTime = _durationTime;
            weverVault = _weverVault;
            weverRoot = _weverRoot;
            directSellGas = _directSellGas;
            if (startTime > 0 && durationTime > 0) {
                endTime = startTime + durationTime;
            }
            price = _price;
            currentVersion++;

            ITokenRoot(paymentToken).deployWallet{
                value: 0,
                flag: 128,
                callback: DirectSell.onTokenWallet
            }(address(this), Gas.DEPLOY_EMPTY_WALLET_GRAMS);
        } else {
            msg.sender.transfer(0, false, 128 + 32);
        }
    }

    function onTokenWallet(address _wallet) external {
        require(
          msg.sender.value != 0 &&
          msg.sender == paymentToken,
          DirectBuySellErrors.NOT_FROM_SPENT_TOKEN_ROOT
        );
        _reserve();
        tokenWallet = _wallet;
        changeState(DirectSellStatus.Active);
        owner.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    modifier onlyOwner() {
        require(
            msg.sender.value != 0 &&
            msg.sender == owner,
            DirectBuySellErrors.NOT_OWNER_DIRECT_BUY_SELL
        );
        _;
    }

    function _reserve() internal  {
        tvm.rawReserve(Gas.DIRECT_SELL_INITIAL_BALANCE, 0);
    }
    function calcValue(GasValues value) internal pure returns(uint128) {
        return value.fixedValue + gasToValue(value.dynamicGas, address(this).wid);
    }

    function getTypeContract() external pure returns (string) {
        return "DirectSell";
    }

    function getMarketFee() external view returns (MarketFee) {
        return fee;
    }

    function setMarketFee(MarketFee _fee, address sendGasTo) external onlyFactory {
        _reserve();
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        fee= _fee;
        sendGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    modifier onlyFactory() virtual {
        require(msg.sender.value != 0 && msg.sender == factoryDirectSell, 100);
        _;
    }

    function getInfo() external view returns (DirectSellInfo) {
        return buildInfo();
    }

    function buildBuyPayload(
        uint32 callbackId,
        address buyer
    ) external pure returns (TvmCell) {
        TvmBuilder builder;
        builder.store(callbackId);
        builder.store(buyer);
        return builder.toCell();
    }

    function onAcceptTokensTransfer(
        address, /*token_root*/
        uint128 amount,
        address sender,
        address, /*sender_wallet*/
        address originalGasTo,
        TvmCell payload
    ) external override {
        _reserve();
        uint32 callbackId = 0;
        address buyer = sender;
        TvmSlice payloadSlice = payload.toSlice();
        if (payloadSlice.bits() >= 32) {
            callbackId = payloadSlice.decode(uint32);
        }
        if (payloadSlice.bits() >= 267) {
            buyer = payloadSlice.decode(address);
        }
        TvmCell emptyPayload;
        mapping(address => CallbackParams) callbacks;
        if (
            msg.sender.value != 0 &&
            msg.sender == tokenWallet &&
            msg.value >= calcValue(directSellGas.buy) &&
            currentStatus == DirectSellStatus.Active &&
            amount >= price &&
            ((endTime > 0 && now < endTime) || endTime == 0) &&
            now >= startTime
        ) {
            IDirectSellCallback(buyer).directSellSuccess{
                value: Gas.FRONTENT_CALLBACK_VALUE,
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
            callbacks[buyer] = CallbackParams(Gas.NFT_CALLBACK_VALUE, emptyPayload);

            ITIP4_1NFT(nftAddress).transfer{
                value: 0,
                flag: 128,
                bounce: false
            }(
                buyer,
                originalGasTo,
                callbacks
            );

            _transfer(balance, owner, originalGasTo, tokenWallet, Gas.TOKEN_TRANSFER_VALUE, 1, Gas.DEPLOY_EMPTY_WALLET_GRAMS);

            if (currentFee > 0) {
                emit MarketFeeWithheld(currentFee, paymentToken);
                ITokenWallet(tokenWallet).transfer{
                    value: Gas.FEE_DEPLOY_WALLET_GRAMS + Gas.FEE_EXTRA_VALUE,
                    flag: 0,
                    bounce: false
                }(
                    currentFee,
                    factoryDirectSell,
                    Gas.FEE_DEPLOY_WALLET_GRAMS,
                    originalGasTo,
                    false,
                    emptyPayload
                );
            }
        } else {
            if (endTime > 0 && now >= endTime && currentStatus == DirectSellStatus.Active) {
                IDirectSellCallback(buyer).directSellCancelledOnTime{
                    value: Gas.FRONTENT_CALLBACK_VALUE,
                    flag: 1,
                    bounce: false
                }(
                    callbackId,
                    nftAddress
                );

                changeState(DirectSellStatus.Expired);

                _transfer(amount, buyer, originalGasTo, msg.sender, Gas.TOKEN_TRANSFER_VALUE, 1, uint128(0));

                callbacks[owner] = CallbackParams(Gas.NFT_CALLBACK_VALUE, emptyPayload);

                ITIP4_1NFT(nftAddress).transfer{
                    value: 0,
                    flag: 128,
                    bounce: false
                }(
                    owner,
                    originalGasTo,
                    callbacks
                );
            } else {
                IDirectSellCallback(buyer).directSellNotSuccess{
                    value: Gas.FRONTENT_CALLBACK_VALUE,
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

    function _transfer(uint128 amount, address user, address remainingGasTo, address sender, uint128 value, uint16 flag, uint128 gasDeployTW) private {
        TvmBuilder builder;
        builder.store(remainingGasTo);
        TvmCell emptyPayload;
        if (paymentToken == weverRoot) {
            ITokenWallet(sender).transfer{ value: value, flag: flag, bounce: false }(
                amount,
                weverVault,
                uint128(0),
                user,
                true,
                builder.toCell()
            );
        } else {
            ITokenWallet(sender).transfer{ value: value, flag: flag, bounce: false }(
                amount,
                user,
                gasDeployTW,
                remainingGasTo,
                false,
                emptyPayload
            );
        }
    }

    function onAcceptTokensBurn(
        uint128 amount,
        address /*walletOwner*/,
        address /*wallet*/,
        address user,
        TvmCell payload
    )  external {
        require(msg.sender.value != 0 && msg.sender == weverRoot, BaseErrors.not_wever_root);
        _reserve();
        address remainingGasTo;
        TvmSlice payloadSlice = payload.toSlice();
        if (payloadSlice.bits() >= 267) {
            remainingGasTo = payloadSlice.decode(address);
        }
        if (user == remainingGasTo) {
            user.transfer({ value: 0, flag: 128 + 2, bounce: false });
        } else {
            user.transfer({ value: amount, flag: 1, bounce: false });
            remainingGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
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
        require(currentStatus == DirectSellStatus.Active, DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS);
        require(now >= endTime, DirectBuySellErrors.DIRECT_BUY_SELL_IN_STILL_PROGRESS);
        require(msg.value >= calcValue(directSellGas.cancel), BaseErrors.not_enough_value);
        _reserve();
        IDirectSellCallback(msg.sender).directSellCancelledOnTime{
            value: Gas.FRONTENT_CALLBACK_VALUE,
            flag: 1,
            bounce: false
        }(
            callbackId,
            nftAddress
        );
        changeState(DirectSellStatus.Expired);

        mapping(address => CallbackParams) callbacks;

        TvmCell emptyPayload;
        callbacks[owner] = CallbackParams(Gas.NFT_CALLBACK_VALUE, emptyPayload);

        ITIP4_1NFT(nftAddress).transfer{
            value: 0,
            flag: 128,
            bounce: false
        }(
            owner,
            sendGasTo,
            callbacks
        );

    }

    function closeSell(uint32 callbackId) external onlyOwner {
        require(currentStatus == DirectSellStatus.Active,DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS);
        require(msg.value >= calcValue(directSellGas.cancel), BaseErrors.not_enough_value);
        _reserve();
        IDirectSellCallback(owner).directSellClose{
          value: Gas.FRONTENT_CALLBACK_VALUE,
          flag: 1,
          bounce: false
        }(
          callbackId,
          nftAddress
        );
        changeState(DirectSellStatus.Cancelled);

        mapping(address => CallbackParams) callbacks;
        TvmCell emptyPayload;
        callbacks[owner] = CallbackParams(Gas.NFT_CALLBACK_VALUE, emptyPayload);

        ITIP4_1NFT(nftAddress).transfer{
            value: 0,
            flag: 128,
            bounce: false
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
            _reserve();
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
                fee,
                weverVault,
                weverRoot,
                directSellGas
            );

              tvm.setcode(newCode);
              tvm.setCurrentCode(newCode);

              onCodeUpgrade(cellParams);
        }
    }

    function onCodeUpgrade(TvmCell data) private {}
}
