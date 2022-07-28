pragma ton-solidity >=0.57.1;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./libraries/Gas.sol";
import "./interfaces/IDirectBuyCallback.sol";
import "./libraries/DirectBuyStatus.sol";

import "./errors/DirectBuySellErrors.sol";

import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenRoot.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenWallet.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";

import "./Nft.sol";
import "./modules/TIP4_1/interfaces/INftChangeManager.sol";
import "./modules/TIP4_1/interfaces/ITIP4_1NFT.sol";


contract DirectBuy is IAcceptTokensTransferCallback, INftChangeManager  {
    
    address static factoryDirectBuy;
    address static owner;
    address static spentTokenRoot;
    address static nftAddress;
    uint64 static timeTx;

    uint128 price;

    address spentTokenWallet;
    uint8 currentStatus;
    
    struct DirectBuyDetails {
        address factory;
        address creator;
        address spentToken;
        address nft;
        uint64 _timeTx;
        uint128 _price;
        address spentWallet;
        uint8 status;
        address sender;
    }

    event DirectBuyStateChanged(uint8 from, uint8 to, DirectBuyDetails);

    constructor(uint128 _amount) public {
        if(msg.sender.value != 0 && msg.sender == factoryDirectBuy) {
            changeState(DirectBuyStatus.Create);
            tvm.rawReserve(address(this).balance - msg.value, 0);

            price = _amount;

            ITokenRoot(spentTokenRoot).deployWallet{
                value: Gas.DEPLOY_EMPTY_WALLET_VALUE,
                flag: 1,
                callback: DirectBuy.onTokenWallet
            }(
                address(this),
                Gas.DEPLOY_EMPTY_WALLET_GRAMS
            );
        } else {
            msg.sender.transfer(0, false, 128 + 32);
        }
    }

    modifier onlyOwner() {
       require(msg.sender.value != 0 && msg.sender == owner, DirectBuySellErrors.NOT_OWNER_DIRECT_BUY);
        _;
    }

    function onTokenWallet(address _spentTokenWallet) external {
        require(msg.sender.value != 0 && msg.sender == spentTokenWallet, DirectBuySellErrors.NOT_FROM_SPENT_TOKEN_ROOT);
        spentTokenWallet = _spentTokenWallet;
        changeState(DirectBuyStatus.Active);
    }

    function getDetails() external view returns(DirectBuyDetails){
        return builderDetails();
    }

    function onAcceptTokensTransfer(
        address tokenRoot,
        uint128 amount,
        address sender,
        address, /*senderWallet*/
        address originalGasTo,
        TvmCell /*payload*/
    ) external override {
        tvm.rawReserve(Gas.DIRECT_BUY_INITIAL_BALANCE, 0);
        if (tokenRoot == spentTokenRoot && 
            amount >= price) {
            changeState(DirectBuyStatus.Active);
        } else {
            TvmCell emptyPayload;
            ITokenWallet(msg.sender).transfer {
                value: 0,
                flag: 128,
                bounce: false
            }(
                amount,
                sender,
                uint128(0),
                originalGasTo,
                true,
                emptyPayload
            );
        }
    }

    function onNftChangeManager(
        uint256 /*id*/,
        address nftOwner,
        address /*oldManager*/,
        address newManager,
        address /*collection*/,
        address sendGasTo,
        TvmCell /*payload*/
    ) external override {
        require(msg.sender.value != 0 && msg.sender == nftOwner, DirectBuySellErrors.NOT_NFT_OWNER);
        require(newManager == address(this), DirectBuySellErrors.NOT_NFT_MANAGER);
        require(msg.value >= Gas.DIRECT_BUY_INITIAL_BALANCE + Gas.DEPLOY_EMPTY_WALLET_VALUE, DirectBuySellErrors.VALUE_TOO_LOW);
        tvm.rawReserve(Gas.DIRECT_BUY_INITIAL_BALANCE, 0);

        mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
        if (currentStatus == DirectBuyStatus.Active) {
            ITIP4_1NFT(nftAddress).transfer{ value: Gas.TRANSFER_OWNERSHIP_VALUE, flag: 1, bounce: false }(
                owner,
                sendGasTo,
                callbacks
            );

            TvmCell empty;
            ITokenWallet(spentTokenWallet).transfer{ value: 0, flag: 64, bounce: false }(
                price,
                nftOwner,
                Gas.DEPLOY_EMPTY_WALLET_GRAMS,
                sendGasTo,
                false,
                empty
            );     
            IDirectBuyCallback(nftOwner).directBuySuccess(nftOwner, owner);
            changeState(DirectBuyStatus.Filled);
        } else {
                ITIP4_1NFT(msg.sender).changeManager{ value: 0, flag: 128 }(
                nftOwner,
                sendGasTo,
                callbacks
            );
        }
    }

    function changeState(uint8 newState) private {
		uint8 prevStateN = currentStatus;
		currentStatus = newState;
		emit DirectBuyStateChanged(prevStateN, newState, builderDetails());
	}

    function builderDetails() private view returns (DirectBuyDetails) {
		return
			DirectBuyDetails(
                factoryDirectBuy,
                owner,
                spentTokenRoot,
                nftAddress,
                timeTx,
                price,
                spentTokenWallet,
                currentStatus,
                msg.sender
            );
    }

    function closedDirectBuy() external onlyOwner {
        require(currentStatus == DirectBuyStatus.Active, DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS);
        
        TvmCell emptyPayload;
        ITokenWallet(spentTokenWallet).transfer{
            value: 0,
            flag: 128,
            bounce: false 
        }(
            price,
            owner,
            0,
            owner,
            true,
            emptyPayload
        );
        changeState(DirectBuyStatus.Cancelled);
    }
}