/// We recommend using the compiler version 0.62.0.
/// You can use other versions, but we do not guarantee compatibility of the compiler version.
pragma ever-solidity = 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;


import '../TIP4_1/TIP4_1Collection.sol';
import './interfaces/ITIP4_3Collection.sol';
import './TIP4_3Nft.sol';
import './Index.sol';
import './IndexBasis.sol';


/// This contract implement TIP4_1Collection, ITIP4_3Collection (add indexes)
abstract contract TIP4_3Collection is TIP4_1Collection, ITIP4_3Collection {

    /**
    * Errors
    **/
    uint8 constant value_is_empty = 103;

    /// TvmCell object code of Index contract
    TvmCell _codeIndex;

    /// TvmCell object code of IndexBasis contract
    TvmCell _codeIndexBasis;

    /// Values for deploy/destroy
    uint128 _indexDeployValue = 0.15 ever;
    uint128 _indexDestroyValue = 0.1 ever;
    uint128 _deployIndexBasisValue = 0.4 ever;

    constructor(
        TvmCell codeIndex,
        TvmCell codeIndexBasis
    ) public {
        TvmCell empty;
        require(codeIndex != empty, value_is_empty);
        tvm.accept();

        _codeIndex = codeIndex;
        _codeIndexBasis = codeIndexBasis;

        _supportedInterfaces[
            bytes4(tvm.functionId(ITIP4_3Collection.indexBasisCode)) ^
            bytes4(tvm.functionId(ITIP4_3Collection.indexBasisCodeHash)) ^
            bytes4(tvm.functionId(ITIP4_3Collection.indexCode)) ^
            bytes4(tvm.functionId(ITIP4_3Collection.indexCodeHash)) ^
            bytes4(tvm.functionId(ITIP4_3Collection.resolveIndexBasis))
        ] = true;

        _deployIndexBasis();

    }

    /// _codeIndexBasis can't be empty
    /// Balance value must be greater than _indexDeployValue
    function _deployIndexBasis() internal virtual {
        TvmCell empty;
        require(_codeIndexBasis != empty, value_is_empty);
        require(address(this).balance > _deployIndexBasisValue);

        TvmCell code = _buildIndexBasisCode();
        TvmCell state = _buildIndexBasisState(code, address(this));
        address indexBasis = new IndexBasis{stateInit: state, value: _deployIndexBasisValue}();
    }

    /// @return code - code of IndexBasis contract
    function indexBasisCode() external view override responsible returns (TvmCell code) {
        return {value: 0, flag: 64, bounce: false} (_codeIndexBasis);
    }

    /// @return hash - calculated hash based on the IndexBasis code
    function indexBasisCodeHash() external view override responsible returns (uint256 hash) {
        return {value: 0, flag: 64, bounce: false} tvm.hash(_buildIndexBasisCode());
    }

    /// @return indexBasis - address of IndexBasisCode
    function resolveIndexBasis() external view override responsible returns (address indexBasis) {
        TvmCell code = _buildIndexBasisCode();
        TvmCell state = _buildIndexBasisState(code, address(this));
        uint256 hashState = tvm.hash(state);
        indexBasis = address.makeAddrStd(address(this).wid, hashState);
        return {value: 0, flag: 64, bounce: false} indexBasis;
    }

    /// @notice build IndexBasis code used TvmCell indexBasis code & salt (string stamp)
    /// @return TvmCell indexBasisCode
    /// about salt read more here (https://github.com/tonlabs/TON-Solidity-Compiler/blob/master/API.md#tvmcodesalt)
    function _buildIndexBasisCode() internal virtual view returns (TvmCell) {
        string stamp = "nft";
        TvmBuilder salt;
        salt.store(stamp);
        return tvm.setCodeSalt(_codeIndexBasis, salt.toCell());
    }

    /// @notice Generates a StateInit from code and data
    /// @param code TvmCell code - generated via the _buildIndexBasisCode method
    /// @param collection address of token collection contract
    /// @return TvmCell object - stateInit
    /// about tvm.buildStateInit read more here (https://github.com/tonlabs/TON-Solidity-Compiler/blob/master/API.md#tvmbuildstateinit)
    function _buildIndexBasisState(
        TvmCell code,
        address collection
    ) internal virtual pure returns (TvmCell) {
        return tvm.buildStateInit({
            contr: IndexBasis,
            varInit: {_collection: collection},
            code: code
        });
    }

    /// @return code - code of Index contract
    function indexCode() external view override responsible returns (TvmCell code) {
        return {value: 0, flag: 64, bounce: false} (_codeIndex);
    }

    /// @return hash - calculated hash based on the Index code
    function indexCodeHash() external view override responsible returns (uint256 hash) {
        return {value: 0, flag: 64, bounce: false} tvm.hash(_codeIndex);
    }

    /// @notice build Index code used TvmCell index code & salt (string stamp, address collection, address owner)
    /// @return TvmCell indexBasisCode
    /// about salt read more here (https://github.com/tonlabs/TON-Solidity-Compiler/blob/master/API.md#tvmcodesalt)
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

    /// @notice Generates a StateInit from code and data
    /// @param code TvmCell code - generated via the _buildIndexCode method
    /// @param nft address of Nft contract
    /// @return TvmCell object - stateInit
    /// about tvm.buildStateInit read more here (https://github.com/tonlabs/TON-Solidity-Compiler/blob/master/API.md#tvmbuildstateinit)
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

    /// Overrides standard method, because Nft contract is changed
    function _buildNftState(
        TvmCell code,
        uint256 id
    ) internal virtual override pure returns (TvmCell) {
        return tvm.buildStateInit({
            contr: TIP4_3Nft,
            varInit: {_id: id},
            code: code
        });
    }

}
