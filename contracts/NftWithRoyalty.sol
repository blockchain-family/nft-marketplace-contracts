pragma ever-solidity ^0.61.2;

pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;

import './interfaces/IBurnableCollection.sol';
import "./modules/TIP4_1/TIP4_1Nft.sol";
import "./modules/TIP4_2/TIP4_2Nft.sol";
import "./modules/TIP4_3/TIP4_3Nft.sol";
import "./modules/TIP4_royalty/TIP4_royaltyNft.sol";


contract NftWithRoyalty is TIP4_1Nft, TIP4_2Nft, TIP4_3Nft, TIP4_royaltyNft{

    constructor(
        address owner,
        address sendGasTo,
        uint128 remainOnNft,
        string json,
        uint128 indexDeployValue,
        uint128 indexDestroyValue,
        TvmCell codeIndex,
        Royalty royalty
    ) TIP4_1Nft (
        owner,
        sendGasTo,
        remainOnNft
    ) TIP4_2Nft (
        json
    ) TIP4_3Nft (
        indexDeployValue,
        indexDestroyValue,
        codeIndex
    ) TIP4_royaltyNft(
        royalty
    ) public {
        tvm.accept();
    }

    function _beforeTransfer(
        address to,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    )
        internal
        virtual
        override(TIP4_1Nft, TIP4_3Nft)
    {
        TIP4_3Nft._destructIndex(sendGasTo);
    }

    function _afterTransfer(
        address to,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    )
        internal
        virtual
        override(TIP4_1Nft, TIP4_3Nft)
    {
        TIP4_3Nft._deployIndex();
    }

    function _beforeChangeOwner(
        address oldOwner,
        address newOwner,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    )
        internal
        virtual
        override(TIP4_1Nft, TIP4_3Nft)
    {
        TIP4_3Nft._destructIndex(sendGasTo);
    }

    function _afterChangeOwner(
        address oldOwner,
        address newOwner,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    )
        internal
        virtual
        override(TIP4_1Nft, TIP4_3Nft)
    {
        TIP4_3Nft._deployIndex();
    }

    function burn(
        address sendGasTo,
        address callbackTo,
        TvmCell callbackPayload
    )
        external
        virtual
        onlyManager
    {
        tvm.accept();
        IBurnableCollection(_collection).acceptNftBurn{ 
            value: 0, 
            flag: 128 + 32, 
            bounce: false
        }(
            _id,
            _owner,
            _manager,
            sendGasTo,
            callbackTo,
            callbackPayload
        );
    }
}
