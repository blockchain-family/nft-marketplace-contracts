/// We recommend using the compiler version 0.62.0.
/// You can use other versions, but we do not guarantee compatibility of the compiler version.
pragma ever-solidity = 0.61.2;


pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;


import '../TIP6/TIP6.sol';
import './interfaces/ITIP4_1Collection.sol';
import './TIP4_1Nft.sol';


/// @title One of the required contracts of an TIP4-1(Non-Fungible Token Standard) compliant technology.
/// You can read more about the technology here (https://github.com/nftalliance/docs/blob/main/src/Standard/TIP-4/1.md)
/// For detect what interfaces a smart contract implements used TIP-6.1 standard. ...
/// ... Read more here (https://github.com/nftalliance/docs/blob/main/src/Standard/TIP-6/1.md)
abstract contract TIP4_1Collection is ITIP4_1Collection, TIP6 {

    /// Code of the TIP4_1Nft conract or of the custom Nft contract based on the TIP4_1Nft
    TvmCell _codeNft;

    /// Number of minted tokens
    uint128 _totalSupply;

    constructor(TvmCell codeNft) public {
        tvm.accept();

        _codeNft = codeNft;

        _supportedInterfaces[ bytes4(tvm.functionId(ITIP6.supportsInterface)) ] = true;
        _supportedInterfaces[
            bytes4(tvm.functionId(ITIP4_1Collection.totalSupply)) ^
            bytes4(tvm.functionId(ITIP4_1Collection.nftCode)) ^
            bytes4(tvm.functionId(ITIP4_1Collection.nftCodeHash)) ^
            bytes4(tvm.functionId(ITIP4_1Collection.nftAddress))
        ] = true;
    }

    /// @notice Count active NFTs for this collection
    /// @return count A count of active NFTs minted by this contract except for burned NFTs
    function totalSupply() external view virtual override responsible returns (uint128 count) {
        return {value: 0, flag: 64, bounce: false} (_totalSupply);
    }

    /// @notice Returns the NFT code
    /// @return code Returns the NFT code as TvmCell
    function nftCode() external view virtual override responsible returns (TvmCell code) {
        return {value: 0, flag: 64, bounce: false} (_buildNftCode(address(this)));
    }

    /// @notice Returns the NFT code hash
    /// @return codeHash Returns the NFT code hash
    function nftCodeHash() external view virtual override responsible returns (uint256 codeHash) {
        return {value: 0, flag: 64, bounce: false} (tvm.hash(_buildNftCode(address(this))));
    }

    /// @notice Computes NFT address by unique NFT id
    /// @dev Return unique address for all Ids. You find nothing by address for not a valid NFT.
    /// @param id Unique NFT id
    /// @return nft Returns address of NFT contract
    function nftAddress(
        uint256 id
    ) external view virtual override responsible returns (address nft) {
        return {value: 0, flag: 64, bounce: false} (_resolveNft(id));
    }

    /// @notice Resolve nft address used collection & nft id
    /// @param id Unique nft number
    function _resolveNft(
        uint256 id
    ) internal virtual view returns (address nft) {
        TvmCell code = _buildNftCode(address(this));
        TvmCell state = _buildNftState(code, id);
        uint256 hashState = tvm.hash(state);
        nft = address.makeAddrStd(address(this).wid, hashState);
    }

    /// @notice build nft code used TvmCell nft code & salt (address collection) ...
    /// ... to create unique nft address BC nft code & id can be repeated
    /// @param collection - collection address
    /// @return TvmCell nftCode
    /// about salt read more here (https://github.com/tonlabs/TON-Solidity-Compiler/blob/master/API.md#tvmcodesalt)
    function _buildNftCode(address collection) internal virtual view returns (TvmCell) {
        TvmBuilder salt;
        salt.store(collection);
        return tvm.setCodeSalt(_codeNft, salt.toCell());
    }

    /// @notice Generates a StateInit from code and data
    /// @param code TvmCell code - generated via the _buildNftCode method
    /// @param id Unique nft number
    /// @return TvmCell object - stateInit
    /// about tvm.buildStateInit read more here (https://github.com/tonlabs/TON-Solidity-Compiler/blob/master/API.md#tvmbuildstateinit)
    function _buildNftState(
        TvmCell code,
        uint256 id
    ) internal virtual pure returns (TvmCell) {
        return tvm.buildStateInit({
            contr: TIP4_1Nft,
            varInit: {_id: id},
            code: code
        });
    }

    function _isOwner() internal virtual returns(bool) {
        return true;
    }

}
