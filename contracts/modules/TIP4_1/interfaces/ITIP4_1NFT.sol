pragma ever-solidity >= 0.61.2;

import "../structures/ICallbackParamsStructure.sol";

interface ITIP4_1NFT is ICallbackParamsStructure {

    /// @notice The event emits when NFT created
    /// @dev Emit the event when NFT is ready to use
    /// @param id Unique NFT id
    /// @param owner Address of NFT owner
    /// @param manager Address of NFT manager
    /// @param collection Address of collection smart contract, that mint the NFT
    event NftCreated(uint256 id, address owner, address manager, address collection);

    /// @notice The event emits when NFT owner changed
    /// @param oldOwner Address of NFT owner before owner changed
    /// @param newOwner Address of new NFT owner
    event OwnerChanged(address oldOwner, address newOwner);

    /// @notice The event emits when NFT manager changed
    /// @param oldManager Address of NFT manager before manager changed
    /// @param newManager Address of new NFT manager
    event ManagerChanged(address oldManager, address newManager);

    /// @param id Unique NFT id
    /// @param owner Address of NFT owner
    /// @param manager Address of NFT manager
    /// @param collection Address of collection smart contract, that mint the NFT
    event NftBurned(uint256 id, address owner, address manager, address collection);

    /// @notice NFT info
    /// @return id Unique NFT id
    /// @return owner Address of NFT owner
    /// @return manager Address of NFT manager
    /// @return collection Address of collection smart contract
    function getInfo() external view responsible returns(
        uint256 id,
        address owner,
        address manager,
        address collection
        );

    /// @notice Change NFT owner
    /// @dev Invoked from manager address only
    /// @dev Good practices is сhange manager address to newOwner address too
    /// @dev Emit OwnerChanged
    /// @dev Emit ManagerChanged events if manager address changed
    /// @param newOwner - New owner of NFT
    /// @param sendGasTo - Address to send remaining gas
    /// @param callbacks - Callbacks array to send by addresses. It can be empty.
    function changeOwner(
        address newOwner,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    ) external;

    /// @notice Change NFT manager
    /// @dev Invoked from manager address only
    /// @dev Emit ManagerChanged event
    /// @param newManager - New manager of NFT
    /// @param sendGasTo - Address to send remaining gas
    /// @param callbacks - Callbacks array to send by addresses. It can be empty.
    function changeManager(
        address newManager,
        address sendGasTo,
        mapping(address => CallbackParams)  callbacks
    ) external;

    /// @notice Change NFT owner and manager
    /// @dev Invoked from manager address only
    /// @dev Emit OwnerChanged
    /// @dev Emit ManagerChanged
    /// @param to - New NFT owner and manager
    /// @param sendGasTo Address to send remaining gas
    /// @param callbacks Callbacks array to send by addresses. It can be empty
    function transfer(
        address to,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    ) external;

}
