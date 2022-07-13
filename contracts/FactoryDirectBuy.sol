pragma ton-solidity >=0.57.1;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./libraries/Gas.sol";

import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenWallet.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "ton-eth-bridge-token-contracts/contracts/TokenWalletPlatform.sol";

import "./DirectBuy.sol";

contract FactoryDirectBuy is IAcceptTokensTransferCallback {

    uint64 static nonce_;
    address static owner;

    TvmCell tokenPlatformCode;
    TvmCell codeNft;
    TvmCell directBuyCode;
    
    constructor(address _owner) public {
        require(_owner.value != 0);
        tvm.accept();
        tvm.rawReserve(Gas.DIRECT_BUY_INITIAL_BALANCE, 0);
        
        owner = _owner;
    } 

    function buildPayload(address nft) external pure returns (TvmCell) {
        return abi.encode(nft);
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

        // Может быть через бридж???
        TvmSlice payloadSlice = payload.toSlice();
        if (payloadSlice.bits() == 267 &&
            msg.sender.value != 0 &&
            msg.sender == expectedAddressTokenRoot(tokenRoot, sender)) 
        {
           (address nft) = payloadSlice.decode(address);
           
           address directBuyAddress = new DirectBuy {
             stateInit: _buildDirectBuyStateInit(
                sender, 
                tokenRoot,
                nft,
                uint64(now)),
            value: Gas.DEPLOY_DIRECT_BUY_MIN_VALUE
           }(
            amount,
            codeNft
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