pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./errors/BaseErrors.sol";

import "./libraries/Gas.sol";

import "./interfaces/IDirectBuyCallback.sol";
import "./interfaces/IUpgradableByRequest.sol";
import "./interfaces/IEventsMarketFee.sol";
import "./interfaces/IOffer.sol";

import "./structures/IMarketFeeStructure.sol";
import "./structures/IGasValueStructure.sol";
import "./structures/IDirectBuyGasValuesStructure.sol";

import "./modules/access/OwnableInternal.sol";

import "./DirectBuy.sol";

import "tip3/contracts/interfaces/ITokenWallet.sol";
import "tip3/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "tip3/contracts/TokenWalletPlatform.sol";

contract FactoryDirectBuy is IAcceptTokensTransferCallback, OwnableInternal, IMarketFeeStructure, IEventMarketFee, IGasValueStructure, IDirectBuyGasValuesStructure {
    uint64 static nonce_;

    TvmCell tokenPlatformCode;
    TvmCell directBuyCode;


    uint32 currentVersion;
    uint32 currectVersionDirectBuy;
    MarketFee fee;
    address public weverVault;
    address public weverRoot;
    DirectBuyGasValues directBuyGas;

    event DirectBuyDeployed(
        address directBuy,
        address sender,
        address token,
        address nft,
        uint64 nonce,
        uint128 amount
    );

    event DirectBuyDeclined(address sender, address token, uint128 amount, address nft);
    event FactoryDirectBuyUpgrade();

    constructor(
        address _owner,
        address sendGasTo,
        MarketFee _fee,
        address _weverVault,
        address _weverRoot
    ) OwnableInternal(_owner) public
    {
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        tvm.accept();
        _reserve();
        currentVersion++;
        fee = _fee;
        emit MarketFeeDefaultChanged(_fee);
        weverVault = _weverVault;
        weverRoot = _weverRoot;
        _transferOwnership(_owner);
        sendGasTo.transfer({ value: 0, flag: 128, bounce: false });

        directBuyGas = DirectBuyGasValues(
            //gasK
            valueToGas(1 ever, address(this).wid),
            // deploy token wallet
            GasValues(
                // fixed
                Gas.DIRECT_BUY_INITIAL_BALANCE +
                Gas.DEPLOY_EMPTY_WALLET_GRAMS +
                Gas.DEPLOY_WALLET_ROOT_COMPENSATION,
                //dynamic
                valueToGas(Gas.DEPLOY_WALLET_EXTRA_GAS, address(this).wid)
            ),
            // deploy direct sell
            GasValues(
                // fixed
                Gas.DIRECT_BUY_INITIAL_BALANCE,
                //dynamic
                valueToGas(Gas.DEPLOY_DIRECT_BUY_EXTRA_VALUE, address(this).wid)
            ),
            //make
            GasValues(
                // fixed
                Gas.FACTORY_DIRECT_BUY_INITIAL_BALANCE +
                Gas.DIRECT_BUY_INITIAL_BALANCE +
                Gas.DEPLOY_EMPTY_WALLET_GRAMS +
                Gas.DEPLOY_WALLET_ROOT_COMPENSATION +
                Gas.FRONTENT_CALLBACK_VALUE,
                //dynamic
                valueToGas(Gas.MAKE_OFFER_EXTRA_GAS_VALUE + Gas.DEPLOY_WALLET_EXTRA_GAS + Gas.DEPLOY_DIRECT_BUY_EXTRA_VALUE, address(this).wid)
            ),
            //accept
            GasValues(
                // fixed
                Gas.DIRECT_BUY_INITIAL_BALANCE +
                Gas.FRONTENT_CALLBACK_VALUE +
                Gas.NFT_CALLBACK_VALUE +
                Gas.TRANSFER_OWNERSHIP_VALUE +
                Gas.FEE_EXTRA_VALUE +
                Gas.TOKEN_TRANSFER_VALUE,
                //dynamic
                valueToGas(Gas.ACCEPT_OFFER_EXTRA_GAS_VALUE, address(this).wid)
            ),
            // cancel
            GasValues(
                // fixed
                Gas.DIRECT_BUY_INITIAL_BALANCE +
                Gas.FRONTENT_CALLBACK_VALUE +
                Gas.TOKEN_TRANSFER_VALUE,
                //dynamic
                valueToGas(Gas.CANCEL_OFFER_EXTRA_GAS_VALUE, address(this).wid)
            )
        );
    }

    function _reserve() internal  {
        tvm.rawReserve(Gas.FACTORY_DIRECT_BUY_INITIAL_BALANCE, 0);
    }

    function calcValue(GasValues value) internal pure returns(uint128) {
        return value.fixedValue + gasToValue(value.dynamicGas, address(this).wid);
    }

    function getGasValue() external view returns (DirectBuyGasValues) {
        return directBuyGas;
    }

    function getTypeContract() external pure returns (string) {
        return "FactoryDirectBuy";
    }

    function getMarketFee() external view returns (MarketFee) {
        return fee;
    }

    function setMarketFee(MarketFee _fee) external onlyOwner {
        _reserve();
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        fee = _fee;
        emit MarketFeeDefaultChanged(_fee);
        msg.sender.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function setMarketFeeForDirectBuy(address directBuy, MarketFee _fee) external onlyOwner {
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        IOffer(directBuy).setMarketFee{value: 0, flag: 64, bounce:false}(_fee, msg.sender);
        emit MarketFeeChanged(directBuy, _fee);
    }

    function buildDirectBuyCreationPayload(
        uint32 callbackId,
        address buyer,
        address nft,
        uint64 startTime,
        uint64 durationTime
    ) external pure returns (TvmCell) {
        TvmBuilder builder;
        builder.store(callbackId);
        builder.store(buyer);
        builder.store(nft);
        builder.store(startTime);
        builder.store(durationTime);
        return builder.toCell();
    }

    function setCodeTokenPlatform(TvmCell _tokenPlatformCode) public onlyOwner {
        _reserve();
        tokenPlatformCode = _tokenPlatformCode;

        msg.sender.transfer(
          0,
              false,
              128 + 2
        );
    }

    function setCodeDirectBuy(TvmCell _directBuyCode) public onlyOwner {
        _reserve();
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
        _reserve();
        uint32 callbackId = 0;
        address buyer = sender;
        address nftForBuy;
        TvmSlice payloadSlice = payload.toSlice();
        if (payloadSlice.bits() >= 32) {
            callbackId = payloadSlice.decode(uint32);
        }
        if (payloadSlice.bits() >= 267) {
            buyer = payloadSlice.decode(address);
        }
        if (payloadSlice.bits() >= 267) {
            nftForBuy = payloadSlice.decode(address);
        }
        if (
            payloadSlice.bits() == 128 &&
            msg.sender.value != 0 &&
            msg.sender == getTokenWallet(tokenRoot, address(this)) &&
            msg.value >= calcValue(directBuyGas.make)
        ) {
            (uint64 startTime, uint64 durationTime) = payloadSlice.decode(uint64, uint64);
            uint64 nonce = tx.timestamp;

            TvmCell stateInit = _buildDirectBuyStateInit(buyer, tokenRoot, nftForBuy, nonce);
            address directBuyAddress = address(tvm.hash(stateInit));

            new DirectBuy {
                stateInit: stateInit,
                value: calcValue(directBuyGas.deployDirectBuy),
                flag: 1
            }(
                amount,
                startTime,
                durationTime,
                getTokenWallet(tokenRoot, directBuyAddress),
                fee,
                weverVault,
                weverRoot,
                directBuyGas
            );

            emit DirectBuyDeployed(directBuyAddress, buyer, tokenRoot, nftForBuy, nonce, amount);
                IDirectBuyCallback(buyer).directBuyDeployed{
                value: Gas.FRONTENT_CALLBACK_VALUE,
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
            emit DirectBuyDeclined(buyer, tokenRoot, amount, nftForBuy);
                IDirectBuyCallback(buyer).directBuyDeployedDeclined{
                value: Gas.FRONTENT_CALLBACK_VALUE,
                flag: 1,
                bounce: false
            }(
                callbackId,
                buyer,
                tokenRoot,
                amount,
                nftForBuy
            );
            TvmBuilder builder;
            builder.store(originalGasTo);
            TvmCell emptyPayload;
            if (tokenRoot == weverRoot) {
                ITokenWallet(msg.sender).transfer{ value: 0, flag: 128, bounce: false }(
                    amount,
                    weverVault,
                    uint128(0),
                    buyer,
                    true,
                    builder.toCell()
                );
            } else {
                ITokenWallet(msg.sender).transfer{ value: 0, flag: 128, bounce: false }(
                    amount,
                    buyer,
                    uint128(0),
                    originalGasTo,
                    true,
                    emptyPayload
                );
            }
        }
    }

    function onAcceptTokensBurn(
        uint128 amount,
        address /*walletOwner*/,
        address /*wallet*/,
        address user,
        TvmCell payload
    )  external {
        address remainingGasTo;
        TvmSlice payloadSlice = payload.toSlice();
        if (payloadSlice.bits() >= 267) {
            remainingGasTo = payloadSlice.decode(address);
        }
        require(msg.sender.value != 0 && msg.sender == weverRoot, BaseErrors.not_wever_root);
        _reserve();

        if (user == remainingGasTo) {
            user.transfer({ value: 0, flag: 128 + 2, bounce: false });
        } else {
            user.transfer({ value: amount, flag: 1, bounce: false });
            remainingGasTo.transfer({ value: 0, flag: 128 + 2, bounce: false });
        }
   }


    function withdraw(address tokenWallet, uint128 amount, address recipient, address remainingGasTo) external onlyOwner {
        require(recipient.value != 0, DirectBuySellErrors.WRONG_RECIPIENT);
        require(msg.value >= Gas.WITHDRAW_VALUE, DirectBuySellErrors.LOW_GAS);

        _reserve();
        TvmCell emptyPayload;
        ITokenWallet(tokenWallet).transfer{value: 0, flag: 128, bounce: false }
            (amount, recipient, Gas.DEPLOY_EMPTY_WALLET_GRAMS, remainingGasTo, false, emptyPayload);
        emit MarketFeeWithdrawn(recipient,amount, tokenWallet);
        msg.sender.transfer({ value: 0, flag: 128 + 2, bounce: false });
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

    function RequestUpgradeDirectBuy(
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
            _reserve();
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
                currectVersionDirectBuy,
                tokenPlatformCode,
                directBuyCode,
                fee,
                weverVault,
                weverRoot,
                directBuyGas
            );
            
            tvm.setcode(newCode);
            tvm.setCurrentCode(newCode);

            onCodeUpgrade(cellParams);
        }
    }

    function onCodeUpgrade(TvmCell data) private {}
}

