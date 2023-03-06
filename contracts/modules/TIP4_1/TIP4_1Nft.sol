/// We recommend using the compiler version 0.62.0.
/// You can use other versions, but we do not guarantee compatibility of the compiler version.
pragma ever-solidity = 0.61.2;


pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;


import './interfaces/ITIP4_1NFT.sol';
import './interfaces/INftChangeOwner.sol';
import './interfaces/INftChangeManager.sol';
import './interfaces/INftTransfer.sol';

import '../TIP6/TIP6.sol';
import "./structures/ICallbackParamsStructure.sol";


/// @title One of the required contracts of an TIP4-1(Non-Fungible Token Standard) compliant technology.
/// You can read more about the technology here (https://github.com/nftalliance/docs/blob/main/src/Standard/TIP-4/1.md)
/// For detect what interfaces a smart contract implements used TIP-6.1 standard. ...
/// ... Read more here (https://github.com/nftalliance/docs/blob/main/src/Standard/TIP-6/1.md)
abstract contract TIP4_1Nft is ITIP4_1NFT, TIP6 {

    /**
    * Errors
    **/
    uint8 constant value_is_empty = 101;
    uint8 constant sender_is_not_collection = 102;
    uint8 constant sender_is_not_manager = 103;
    uint8 constant value_is_less_than_required = 104;

    /// Unique NFT id
    uint256 static _id;

    /// Address of NftCollection contract
    address _collection;

    /// Owner address
    address _owner;

    /// Manager address. Used in onlyManager modifier.
    address _manager;

    /**
        @notice Initializes the contract by setting a `owner` to the NFT.
        Collection address get from the contract code that is "building" into Collection._buildNftCode, Collection._buildNftState
        _supportedInterfaces mapping used in TIP-6 standart
        Emit TokenMinted event
    */
    constructor(
        address owner,
        address sendGasTo,
        uint128 remainOnNft
    ) public {
        optional(TvmCell) optSalt = tvm.codeSalt(tvm.code());
        require(optSalt.hasValue(), value_is_empty);
        (address collection) = optSalt.get().toSlice().decode(address);
        require(msg.sender == collection, sender_is_not_collection);
        require(remainOnNft != 0, value_is_empty);
        require(msg.value > remainOnNft, value_is_less_than_required);
        tvm.rawReserve(remainOnNft, 0);

        _collection = collection;
        _owner = owner;
        _manager = owner;

        _supportedInterfaces[ bytes4(tvm.functionId(ITIP6.supportsInterface)) ] = true;
        _supportedInterfaces[
            bytes4(tvm.functionId(ITIP4_1NFT.getInfo)) ^
            bytes4(tvm.functionId(ITIP4_1NFT.changeOwner)) ^
            bytes4(tvm.functionId(ITIP4_1NFT.changeManager)) ^
            bytes4(tvm.functionId(ITIP4_1NFT.transfer))

        ] = true;

        emit NftCreated(_id, _owner, _manager, _collection);

        sendGasTo.transfer({value: 0, flag: 128 + 2});
    }

    /// @notice Transfers ownership to another account (set new owner & manager)
    /// @param to - the future owner of the token
    /// @param sendGasTo - the address to which the remaining gas will be sent
    /// @param callbacks - key (destination address for callback) => ..
    /// .. value (CallbackParams structure ( CallbackParams { uint128 value; TvmCell payload; } ))
    /// Can only be called from the manager's address
    /// Requirements:
    ///
    /// - `to` can't be the zero address.
    /// - `sendGasTo` can't be the zero address.
    /// - `callbacks` can be the zero mapping.
    /// - Callbacks(key) address must implement {INftTransfer-onNftTransfer}.
    ///
    /// Emits a {OwnerChanged} event if to != oldOwner && Emits a {ManagerChanged} event if to != oldManager.
    function transfer(
        address to,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    ) public virtual override onlyManager {
        tvm.rawReserve(0, 4);

        _beforeTransfer(to, sendGasTo, callbacks);

        address oldOwner = _owner;
        _changeOwner(to);
        _changeManager(to);

        _afterTransfer(to, sendGasTo, callbacks);

        for ((address dest, CallbackParams p) : callbacks) {
            INftTransfer(dest).onNftTransfer{
                value: p.value,
                flag: 0 + 1,
                bounce: false
            }(_id, oldOwner, to, _manager, to, _collection, sendGasTo, p.payload);
        }

        if (sendGasTo.value != 0) {
            sendGasTo.transfer({
                value: 0,
                flag: 128 + 2,
                bounce: false
            });
        }

    }

    /// @notice Change Nft owner
    /// @param newOwner - the future owner of the token
    /// @param sendGasTo - the address to which the remaining gas will be sent
    /// @param callbacks - key (destination address for callback) => ..
    /// .. value (CallbackParams structure ( CallbackParams { uint128 value; TvmCell payload; } ))
    /// Can only be called from the manager's address
    /// Requirements:
    ///
    /// - `newOwner` can't be the zero address.
    /// - `sendGasTo` can't be the zero address.
    /// - `callbacks` can be the zero mapping.
    /// - Callbacks(key) address must implement {INftChangeOwner-onNftChangeOwner}.
    ///
    /// Emits a {OwnerChanged} event if newOwner != oldOwner
    function changeOwner(
        address newOwner,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    ) public virtual override onlyManager {
        tvm.rawReserve(0, 4);

        _beforeChangeOwner(_owner, newOwner, sendGasTo, callbacks);

        address oldOwner = _owner;
        _changeOwner(newOwner);

        _afterChangeOwner(oldOwner, newOwner, sendGasTo, callbacks);

        for ((address dest, CallbackParams p) : callbacks) {
            INftChangeOwner(dest).onNftChangeOwner{
                value: p.value,
                flag: 0 + 1,
                bounce: false
            }(_id, _manager, oldOwner, newOwner, _collection, sendGasTo, p.payload);
        }

        if (sendGasTo.value != 0) {
            sendGasTo.transfer({
                value: 0,
                flag: 128 + 2,
                bounce: false
            });
        }

    }

    function _changeOwner(
        address newOwner
    ) internal {
        address oldOwner = _owner;
        _owner = newOwner;
        if (oldOwner != newOwner) {
            emit OwnerChanged(oldOwner, newOwner);
        }
    }


    /// @notice Set a new manager
    /// @param newManager - future manager of the token
    /// @param sendGasTo - the address to which the remaining gas will be sent
    /// @param callbacks - key (destination address for callback) => ..
    /// .. value (CallbackParams structure ( CallbackParams { uint128 value; TvmCell payload; } ))
    /// Can only be called from the manager's address
    /// Requirements:
    ///
    /// - `newManager` cannot be the zero address.
    /// - `sendGasTo` can be the zero address.
    /// - `callbacks` can be the zero mapping.
    /// - Callbacks(key) address must implement {INftChangeManager-onNftChangeManager}.
    ///
    /// Emits a {ManagerChanged} event if newManager != oldManager.
    function changeManager(
        address newManager,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    ) external virtual override onlyManager {
        tvm.rawReserve(0, 4);

        _beforeChangeManager(_manager, newManager, sendGasTo, callbacks);

        address oldManager = _manager;
        _changeManager(newManager);

        _afterChangeManager(oldManager, newManager, sendGasTo, callbacks);

        for ((address dest, CallbackParams p) : callbacks) {
            INftChangeManager(dest).onNftChangeManager{
                value: p.value,
                flag: 0 + 1,
                bounce: false
            }(_id, _owner, oldManager, newManager, _collection, sendGasTo, p.payload);
        }

        if (sendGasTo.value != 0) {
            sendGasTo.transfer({
                value: 0,
                flag: 128 + 2,
                bounce: false
            });
        }

    }

    function _changeManager(
        address newManager
    ) internal {
        address oldManager = _manager;
        _manager = newManager;
        if (oldManager != newManager) {
            emit ManagerChanged(oldManager, newManager);
        }
    }

    /// @notice Returns the main parameters of the token.
    /// @return id - Unique NFT id
    /// @return owner - Nft owner
    /// @return manager - Nft manager (Used for contract management)
    /// @return collection - Collection address (creator)
    ///
    /// Both internal message and external message can be called.
    /// In case of calling external message, you need to add the answerId = 0 parameter
    function getInfo() external view virtual override responsible returns(
        uint256 id,
        address owner,
        address manager,
        address collection)
    {
        return {value: 0, flag: 64, bounce: false} (
            _id,
            _owner,
            _manager,
            _collection
        );
    }

    function _beforeTransfer(
        address to,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    ) internal virtual {
        to; sendGasTo; callbacks; //disable warnings
    }

    function _afterTransfer(
        address to,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    ) internal virtual {
        to; sendGasTo; callbacks; //disable warnings
    }

    function _beforeChangeOwner(
        address oldOwner,
        address newOwner,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    ) internal virtual {
        oldOwner; newOwner; sendGasTo; callbacks; //disable warnings
    }

    function _afterChangeOwner(
        address oldOwner,
        address newOwner,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    ) internal virtual {
        oldOwner; newOwner; sendGasTo; callbacks; //disable warnings
    }

    function _beforeChangeManager(
        address oldManager,
        address newManager,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    ) internal virtual {
        oldManager; newManager; sendGasTo; callbacks; //disable warnings
    }

    function _afterChangeManager(
        address oldManager,
        address newManager,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    ) internal virtual {
        oldManager; newManager; sendGasTo; callbacks; //disable warnings
    }

    modifier onlyManager virtual {
        require(msg.sender == _manager, sender_is_not_manager);
        _;
    }
}
