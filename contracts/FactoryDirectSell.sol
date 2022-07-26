pragma ton-solidity >=0.57.1;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./libraries/Gas.sol";

import "./interfaces/IDirectSellCallback.sol";
import "./modules/access/OwnableInternal.sol";

import "./errors/DirectBuySellErrors.sol";

import "./Nft.sol";
import "./modules/TIP4_1/interfaces/INftChangeManager.sol";
import "./modules/TIP4_1/interfaces/ITIP4_1NFT.sol";

import "./DirectSell.sol";

contract FactoryDirectSell is OwnableInternal, INftChangeManager {

    uint64 static nonce_;

    TvmCell directSellCode;
    
    event DirectSellDeployed(address sender, address paymentToken, address nft, uint64 _nonce, uint128 price);
    event DirectSellDeclined(address sender);

    constructor(
        address _owner,
        address sendGasTo
    ) OwnableInternal(
        _owner
    ) public {
        tvm.accept();
        tvm.rawReserve(Gas.DIRECT_SELL_INITIAL_BALANCE, 0);    

        _transferOwnership(_owner);
        sendGasTo.transfer({ value: 0, flag: 128, bounce: false });
    }   

    function buildPayload(
        address _nftAddress,
        uint64 _startAuction, 
        optional(uint64)_endAuction, 
        address _paymentToken,
        uint128 _price
        ) external pure returns(TvmCell) {
            
        return abi.encode(
            _nftAddress,
            _startAuction, 
            _endAuction.hasValue() ? _endAuction : 0, 
            _paymentToken, 
            _price
        );
    }

    function onNftChangeManager(
        uint256 /*id*/,
        address nftOwner,
        address /*oldManager*/,
        address newManager,
        address /*collection*/,
        address sendGasTo,
        TvmCell payload
    ) external override {
        require(msg.sender.value != 0 && msg.sender == nftOwner, DirectBuySellErrors.NOT_NFT_OWNER);
        require(newManager == address(this), DirectBuySellErrors.NOT_NFT_MANAGER);
        tvm.rawReserve(Gas.DIRECT_BUY_INITIAL_BALANCE, 0);

        mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
        bool needCancel = false;

        TvmSlice payloadSlice = payload.toSlice();
        address nftForSell = payloadSlice.decode(address);
        if (payloadSlice.bits() == 523) {
            (
                uint64 _startAuction,
                uint64 _endAuction,
                address _paymentToken,
                uint128 _price
            ) = payloadSlice.decode(uint64, uint64, address, uint128);
            uint64 _nonce = uint64(now);
            address factoryDirectSell = new DirectSell {
                stateInit: _buildDirectSellStateInit(
                    msg.sender,
                    _paymentToken,
                    nftForSell,
                    _nonce),
                value: Gas.DEPLOY_DIRECT_SELL_MIN_VALUE
            }(
                _startAuction,
                _endAuction,
                _price
            );
            
            emit DirectSellDeployed{dest: nftForSell}(msg.sender, _paymentToken, nftForSell, _nonce, _price); 
            IDirectSellCallback(msg.sender).directSellDeployed(msg.sender, _paymentToken, nftForSell, _nonce, _price);

            ITIP4_1NFT(msg.sender).changeManager { value: 0, flag: 128 }(
                factoryDirectSell,
                sendGasTo,    
                callbacks        
            );

        } else {
            needCancel = true;    
        }

        if (needCancel) {
            emit DirectSellDeclined{dest: nftForSell}(msg.sender);
            IDirectSellCallback(msg.sender).directSellDeclined(msg.sender);

            ITIP4_1NFT(msg.sender).changeManager { value: 0, flag: 128 }(
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
        uint64 _nowTx
    ) private view returns (TvmCell) {
        return 
            tvm.buildStateInit({
                contr: DirectSell,
                varInit: {
                    factoryDirectSell: address(this),
                    owner: _owner,
                    paymentToken: _paymentToken,
                    nftAddress: _nft,
                    nowTx: _nowTx
                },
                code: directSellCode
            });
    }
    
}