pragma ever-solidity >= 0.61.2;


import 'interfaces/IIndex.sol';


/**
 * Errors
 *   101 - Method for NFT only
 *   102 - Salt doesn't contain any value
 **/

/// @title  This contract helps to find:
/// All user tokens in current collection using owner address and collection address
/// All user tokens in all collections using owner address
contract Index is IIndex {

    /// Nft address
    address static _nft;
    
    /// Collection address, it is filled in either via the constructor parameter, or via salt
    address _collection;

    /// Nft owner address
    address _owner;

    constructor(address collection) public {
        optional(TvmCell) salt = tvm.codeSalt(tvm.code());
        require(salt.hasValue(), 102, "Salt doesn't contain any value");
        (, address collection_, address owner) = salt
            .get()
            .toSlice()
            .decode(string, address, address);
        require(msg.sender == _nft);
        tvm.accept();
        _collection = collection_;
        _owner = owner;
        if (collection_.value == 0) {
            _collection = collection;
        }
    }

    /// @return collection (address) - collection token contract address
    /// @return owner (address) - token owner contract address
    /// @return nft (address) - token contract address
    function getInfo() override public view responsible returns (
        address collection,
        address owner,
        address nft
    ) {
        return {value: 0, bounce: false, flag: 64} (
            _collection,
            _owner,
            _nft
        );
    }

    /// @notice This method used for destruct token, can be called only by nft
    /// @param gasReceiver - address where all crystals from the contract will be sent
    function destruct(address gasReceiver) override public {
        require(msg.sender == _nft, 101, "Method for NFT only");
        selfdestruct(gasReceiver);
    }
}