/// We recommend using the compiler version 0.62.0. 
/// You can use other versions, but we do not guarantee compatibility of the compiler version.
pragma ever-solidity = 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;


import '../TIP4_1/TIP4_1Collection.sol';
import './interfaces/ITIP4_2JSON_Metadata.sol';
import './TIP4_2Nft.sol';


/// This contract implement TIP4_1Collection and ITIP4_2JSON_Metadata (add JSON Metadata)
/// Add change deploy contract in _buildNftState (TIP4_1Nft => TIP4_2Nft)
abstract contract TIP4_2Collection is TIP4_1Collection, ITIP4_2JSON_Metadata {

    /// JSON metadata
    /// In order to fill in this field correctly, see https://github.com/nftalliance/docs/blob/main/src/Standard/TIP-4/2.md
    string _json;

    constructor(
        string json
    ) public {
        tvm.accept();

        _json = json;

        _supportedInterfaces[
            bytes4(tvm.functionId(ITIP4_2JSON_Metadata.getJson))
        ] = true;
    }

    /// See interfaces/ITIP4_2JSON_Metadata.sol
    function getJson() external view override responsible returns (string json) {
        return {value: 0, flag: 64, bounce: false} (_json);
    }

    /// Overrides standard method, because Nft contract is changed
    function _buildNftState(
        TvmCell code,
        uint256 id
    ) internal virtual override pure returns (TvmCell) {
        return tvm.buildStateInit({
            contr: TIP4_2Nft,
            varInit: {_id: id},
            code: code
        });
    }

}