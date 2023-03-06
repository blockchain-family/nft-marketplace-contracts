pragma ever-solidity = 0.61.2;

/// @title This extension is used to add the owner role to the contract. It is used to manage contracts through internal messages.
abstract contract OwnableInternal {
    
    /// Owner address (0:...)
    address private owner_;

    event OwnershipTransferred(address oldOwner, address newOwner);

    constructor (address owner) public {
        _transferOwnership(owner);
    }

    function owner() public view virtual returns (address) {
        return owner_;
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner.value != 0, 100);
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = owner_;
        owner_ = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    modifier onlyOwner() virtual {
        require(msg.sender.value != 0 && owner() == msg.sender, 100);
        require(msg.value != 0, 101);
        _;
    }
}
