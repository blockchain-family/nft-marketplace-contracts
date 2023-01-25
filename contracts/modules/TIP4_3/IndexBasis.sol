pragma ever-solidity >= 0.61.2;

import './interfaces/IIndexBasis.sol';

/**
 * Errors
 *   101 - Method for collection only
 **/


/// @title This contract helps to find all collections by the code hash of which

contract IndexBasis is IIndexBasis {

    /// Collection token contract address
    address static _collection;

    modifier onlyCollection() {
        require(msg.sender == _collection, 101, "Method for collection only");
        tvm.accept();
        _;
    }
    
    /// Can only be created using a collection
    constructor() public onlyCollection {}

    /// @return collection - collection token contract address
    function getInfo() override public view responsible returns (address collection) {
        return {value: 0, bounce: false, flag: 64} _collection;
    }

    /// @notice This method used for destruct token, can be called only by nft
    /// @param gasReceiver - address where all crystals from the contract will be sent
    function destruct(address gasReceiver) override public onlyCollection {
        selfdestruct(gasReceiver);
    }
}