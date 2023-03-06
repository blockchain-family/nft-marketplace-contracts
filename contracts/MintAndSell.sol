pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./libraries/Gas.sol";
import "./CollectionSimilar.sol";
import './modules/TIP4_1/TIP4_1Nft.sol';
import './modules/TIP4_1/interfaces/ITIP4_1NFT.sol';
import "./modules/access/OwnableInternal.sol";
import "./structures/INftInfoStructure.sol";
import "./errors/BaseErrors.sol";
import "./modules/TIP4_1/structures/ICallbackParamsStructure.sol";

contract MintAndSell is OwnableInternal, INftInfoStructure, ICallbackParamsStructure  {

    uint64 static nonce_;

    address collection_;
    address targetManager_;
    uint128 targetGas_;
    TvmCell targetPayload_;

    uint256 nftCodeHash_;
    uint16 nftCodeDepth_;

    constructor(
        address _owner,
        address _collection,
        address _targetManager,
        uint128 _targetGas,
        TvmCell _targetPayload
    )
        public
        OwnableInternal(_owner)
    {
        require(address(this).balance >= 1.5 ever, BaseErrors.value_too_low);

        tvm.accept();

        collection_ = _collection;
        targetManager_ = _targetManager;
        targetGas_ = _targetGas;
        targetPayload_ = _targetPayload;

        tvm.rawReserve(1 ever, 0);
        ITIP4_1Collection(collection_).nftCode{
            value: 0,
            flag: 128,
            bounce: true,
            callback: MintAndSell.onNftCode
        }();
    }

    function onNftCode(TvmCell _nftCode) external {
        require(msg.sender.value != 0 && collection_ == msg.sender, BaseErrors.message_sender_is_not_collection);
        tvm.rawReserve(1 ever, 0);
        nftCodeHash_ = tvm.hash(_nftCode);
        nftCodeDepth_ = _nftCode.depth();
        owner().transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function createItems(uint256 _fromId, uint256 _toId) external onlyOwner {
        require(msg.value >= (_toId - _fromId) * 1.2 ever, BaseErrors.value_too_low);
        this.createItemsInternal{
            value: 0,
            flag: 64
        }(_fromId, _toId);
    }

    function createItemsInternal(uint256 _fromId, uint256 _toId) public {
        require(msg.sender == address(this), BaseErrors.message_sender_is_not_self);
        tvm.rawReserve(0, 4);
        uint256 _id = _fromId;

        while (_id  < _fromId + 100 && _id <= _toId) {
            CollectionSimilar(collection_).mintNft{
                value: 1.1 ever,
                flag: 1
            }(address(this), _id, owner());
            _id++;
        }

        if (_id < _toId) {
            this.createItemsInternal{
                value: 0,
                flag: 128
            }(_id, _toId);
        }
    }

    function sellItems(uint256 _fromId, uint256 _toId) external onlyOwner {
        require(msg.value >= (_toId - _fromId + 1) * (targetGas_ + Gas.CHANGE_MANAGER_VALUE + 0.1 ever),
                BaseErrors.value_too_low);
        this.sellItemsInternal{
            value: 0,
            flag: 64
        }(_fromId, _toId);
    }

    function sellItemsInternal(uint256 _fromId, uint256 _toId) public {
        require(msg.sender == address(this), BaseErrors.message_sender_is_not_self);
        tvm.rawReserve(0, 4);
        uint256 _id = _fromId;

        while (_id  < _fromId + 50 && _id <= _toId) {
            mapping(address => CallbackParams) callbacks;
            callbacks[targetManager_] = CallbackParams(targetGas_, targetPayload_);
            ITIP4_1NFT(_resolveNft(_id)).changeManager{
                value: targetGas_ + Gas.CHANGE_MANAGER_VALUE,
                flag: 1
            }(targetManager_, owner(), callbacks);
            _id++;
        }

        if (_id < _toId) {
            this.sellItemsInternal{
                value: 0,
                flag: 128
            }(_id, _toId);
        }
    }

    function _reserve() internal  {
        tvm.rawReserve(0, 4);
    }

    function expectedNftAddress(uint256 _id) external view returns(address nft) {
        nft = _resolveNft(_id);
    }

    function _resolveNft(uint256 _id) internal view returns (address) {
        TvmCell data = tvm.buildDataInit({
            contr: TIP4_1Nft,
            varInit: {_id: _id},
            pubkey: 0
        });
        uint256 dataHash = tvm.hash(data);
        uint16 dataDepth = data.depth();
        uint256 hash = tvm.stateInitHash(nftCodeHash_, dataHash, nftCodeDepth_, dataDepth);
        return address.makeAddrStd(address(this).wid, hash);
    }

    function drainGas() external onlyOwner {
        tvm.rawReserve(1 ever, 0);
        msg.sender.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }

    function getCollectionOwnershipBack(address newOwner) external view onlyOwner {
        CollectionSimilar(collection_).transferOwnership{
                value: 0,
                flag: 64
            }(newOwner);
    }

    function upgrade(
        TvmCell newCode,
        address sendGasTo
    ) external onlyOwner {
        TvmCell cellParams = abi.encode(
            owner(),
            collection_,
            targetManager_,
            targetGas_,
            targetPayload_,
            nftCodeHash_,
            nftCodeDepth_
        );

        tvm.setcode(newCode);
        tvm.setCurrentCode(newCode);

        onCodeUpgrade(cellParams);
    }

    function onCodeUpgrade(TvmCell data) private {}
}
