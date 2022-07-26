pragma ton-solidity >=0.57.1;

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
    
    event DirectBuyDeployed(address sender, address tokenRoot, address nft, uint64 nonce, uint128 amount);
    event DirectBuyDeclined(address sender, address tokenRoot, uint128 amount);

    constructor(
        address _owner,
        address sendGasTo
    ) OwnableInternal (
        _owner
    ) public {
        tvm.accept();
        tvm.rawReserve(Gas.DIRECT_BUY_INITIAL_BALANCE, 0);
        
        _transferOwnership(_owner);
        sendGasTo.transfer({ value: 0, flag: 128, bounce: false });
    } 

    function buildPayload(address nft, uint128 price) external pure returns (TvmCell) {
        return abi.encode(nft, price);
    }

    function onAcceptTokensTransfer(
        address tokenRoot,
        uint128 amount,
        address sender,
        address, /*senderWallet*/
        address originalGasTo,
        TvmCell payload
    ) external override {   
        tvm.rawReserve(Gas.DEPLOY_DIRECT_BUY_MIN_VALUE, 0);     
        bool needCancel = false;

        TvmSlice payloadSlice = payload.toSlice();
        address nftForBuy = payloadSlice.decode(address);
        if (payloadSlice.bits() == 128 &&
            msg.sender.value != 0 &&
            msg.sender == expectedAddressTokenRoot(tokenRoot, sender)) 
        {
            (uint128 price) = payloadSlice.decode(uint128);
            if (amount >= price) {
                uint64 nonce = uint64(now);
                address directBuyAddress = new DirectBuy {
                stateInit: _buildDirectBuyStateInit(
                    sender, 
                    tokenRoot,
                    nftForBuy,
                    nonce),
                value: Gas.DEPLOY_DIRECT_BUY_MIN_VALUE
                 }(
                    amount
                );

                emit DirectBuyDeployed{dest: nftForBuy}(sender, tokenRoot, nftForBuy, nonce, amount);
                IDirectBuyCallback(sender).directBuyDeployed(sender, tokenRoot, nftForBuy, nonce, amount);

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
                needCancel = true;
            }   
        } else {
            needCancel = true;    
        }

        if (needCancel) {
            emit DirectBuyDeclined{dest: nftForBuy}(sender, tokenRoot, amount);
            IDirectBuyCallback(sender).directBuyDeployedDeclined(sender, tokenRoot, amount);

            TvmCell emptyPayload;
            ITokenWallet(msg.sender).transfer {
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

    function _buildDirectBuyStateInit (
        address _owner, 
        address _spentTokenRoot, 
        address _nft, 
        uint64 _nowTx
    ) private view returns (TvmCell) {
		return
			tvm.buildStateInit({
				contr: DirectBuy,
				varInit: {
                    factoryDirectBuy: address(this),
                    owner: _owner, 
                    spentTokenRoot: _spentTokenRoot,
                    nftAddress: _nft,
                    nowTx: _nowTx
                },
				code: directBuyCode
			});
	}

    function expectedAddressDirectBuy (
        address _owner, 
        address _spentTokenRoot, 
        address _nft, 
        uint64 _nowTx, 
        uint128 _amount
    ) external view responsible returns(address) {
        return address(tvm.hash((_buildDirectBuyStateInit(_owner, _spentTokenRoot, _nft, _nowTx))));
    } 

    function expectedAddressTokenRoot(address _tokenRoot, address _sender) internal view returns (address) {
        return address(tvm.hash(
            tvm.buildStateInit({
                contr: TokenWalletPlatform,
                varInit: {
                    root: _tokenRoot,
                    owner: _sender
                },
                code: tokenPlatformCode
            })
        ));        
    }  
}