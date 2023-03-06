pragma ever-solidity = 0.61.2;

/// @title This extension is used to add the owner role to the contract. It is used to manage contracts through external messages.
abstract contract OwnableExternal {
    
    /// Owner pubkey (0x...)
    uint256 private owner_;

    event OwnershipTransferred(uint256 oldOwner, uint256 newOwner);

    constructor (uint256 owner) public {
        _transferOwnership(owner);
    }

    function owner() public view virtual responsible returns (uint256) {
        return {value: 0, bounce: false, flag: 64} owner_;
    }

    function transferOwnership(uint256 newOwner) public virtual onlyOwner {
        require(newOwner != 0, 100);
        _transferOwnership(newOwner);
    }

    function _transferOwnership(uint256 newOwner) internal virtual {
        uint256 oldOwner = owner_;
        owner_ = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    modifier onlyOwner() virtual {
        require(owner() == msg.pubkey(), 100);
        tvm.accept();
        _;
    }

}
