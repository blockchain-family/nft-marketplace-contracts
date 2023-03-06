/// We recommend using the compiler version 0.62.0. 
/// You can use other versions, but we do not guarantee compatibility of the compiler version.
pragma ever-solidity = 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;


import '../TIP4_1/TIP4_1Nft.sol';
import './interfaces/ITIP4_3NFT.sol';
import './Index.sol';


/// This contract implement TIP4_1Collection, ITIP4_3NFT (add indexes)
abstract contract TIP4_3Nft is TIP4_1Nft, ITIP4_3NFT {

    /// Values for deploy/destroy
    uint128 _indexDeployValue;
    uint128 _indexDestroyValue;

    /// TvmCell object code of Index contract
    TvmCell _codeIndex;

    constructor(
        uint128 indexDeployValue,
        uint128 indexDestroyValue,
        TvmCell codeIndex
    ) public {
        _indexDeployValue = indexDeployValue;
        _indexDestroyValue = indexDestroyValue;
        _codeIndex = codeIndex;

        _supportedInterfaces[
            bytes4(tvm.functionId(ITIP4_3NFT.indexCode)) ^
            bytes4(tvm.functionId(ITIP4_3NFT.indexCodeHash)) ^
            bytes4(tvm.functionId(ITIP4_3NFT.resolveIndex)) 
        ] = true;

        _deployIndex();
    }

    function _beforeTransfer(
        address to, 
        address sendGasTo, 
        mapping(address => CallbackParams) callbacks
    ) internal virtual override {
        _destructIndex(sendGasTo);
    }

    function _afterTransfer(
        address to, 
        address sendGasTo, 
        mapping(address => CallbackParams) callbacks
    ) internal virtual override {
        _deployIndex();
    }

    function _beforeChangeOwner(
        address oldOwner, 
        address newOwner,
        address sendGasTo, 
        mapping(address => CallbackParams) callbacks
    ) internal virtual override {
        _destructIndex(sendGasTo);
    }   

    function _afterChangeOwner(
        address oldOwner, 
        address newOwner,
        address sendGasTo, 
        mapping(address => CallbackParams) callbacks
    ) internal virtual override {
        _deployIndex();
    }

    function _deployIndex() internal virtual view {
        TvmCell codeIndexOwner = _buildIndexCode(address(0), _owner);
        TvmCell stateIndexOwner = _buildIndexState(codeIndexOwner, address(this));
        new Index{stateInit: stateIndexOwner, value: _indexDeployValue}(_collection);

        TvmCell codeIndexOwnerRoot = _buildIndexCode(_collection, _owner);
        TvmCell stateIndexOwnerRoot = _buildIndexState(codeIndexOwnerRoot, address(this));
        new Index{stateInit: stateIndexOwnerRoot, value: _indexDeployValue}(_collection);
    }

    function _destructIndex(address sendGasTo) internal virtual view {
        address oldIndexOwner = resolveIndex(address(0), _owner);
        IIndex(oldIndexOwner).destruct{value: _indexDestroyValue}(sendGasTo);
        address oldIndexOwnerRoot = resolveIndex(_collection, _owner);
        IIndex(oldIndexOwnerRoot).destruct{value: _indexDestroyValue}(sendGasTo);
    }
    
    function indexCode() external view override responsible returns (TvmCell code) {
        return {value: 0, flag: 64, bounce: false} (_codeIndex);
    }

    function indexCodeHash() public view override responsible returns (uint256 hash) {
        return {value: 0, flag: 64, bounce: false} tvm.hash(_codeIndex);
    }

    function resolveIndex(
        address collection, 
        address owner
    ) public view override responsible returns (address index) {
        TvmCell code = _buildIndexCode(collection, owner);
        TvmCell state = _buildIndexState(code, address(this));
        uint256 hashState = tvm.hash(state);
        index = address.makeAddrStd(address(this).wid, hashState);
        return {value: 0, flag: 64, bounce: false} index;
    }

    function _buildIndexCode(
        address collection,
        address owner
    ) internal virtual view returns (TvmCell) {
        TvmBuilder salt;
        salt.store("nft");
        salt.store(collection);
        salt.store(owner);
        return tvm.setCodeSalt(_codeIndex, salt.toCell());
    }

    function _buildIndexState(
        TvmCell code,
        address nft
    ) internal virtual pure returns (TvmCell) {
        return tvm.buildStateInit({
            contr: Index,
            varInit: {_nft: nft},
            code: code
        });
    }

}