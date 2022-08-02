pragma ton-solidity >= 0.62.0;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./libraries/Gas.sol";
import "./libraries/DirectSellStatus.sol";
import "./interfaces/IDirectSellCallback.sol";

import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenRoot.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenWallet.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";

import "./Nft.sol";
import "./modules/TIP4_1/interfaces/INftChangeManager.sol";
import "./modules/TIP4_1/interfaces/ITIP4_1NFT.sol";

import "./errors/DirectBuySellErrors.sol";
import "./errors/BaseErrors.sol";

contract DirectSell is IAcceptTokensTransferCallback, INftChangeManager {
    address static factoryDirectSell;
    address static owner;
    address static paymentToken;
    address static nftAddress;
    uint64 static timeTx;
    
    uint64 auctionStart;
    uint64 auctionEnd;

    uint128 price;

    address tokenWallet;
    uint8 currentStatus;
    bool receivedNFT;

    struct DirectSellDetails {
        address factory;
        address creator;
        address token;
        address nft;
        uint64 _timeTx;
        uint64 start;
        uint64 end;
        uint128 _price;
        address wallet;
        uint8 status;
        address sender;
    }

     enum AuctionStatus {
        Created,
        AwaitNFT,
        Active,
        Filled,
        Cancelled
    }
    AuctionStatus state;

    event DirectSellStateChanged(uint8 from, uint8 to, DirectSellDetails);

    constructor(uint64 _auctionStart, uint64 _auctionEnd, uint128 _price) public {
       if(msg.sender.value != 0 && msg.sender == factoryDirectSell) {
            changeState(DirectSellStatus.Create);
            tvm.rawReserve(Gas.DIRECT_SELL_INITIAL_BALANCE, 0);
            auctionStart = _auctionStart;
            auctionEnd = _auctionEnd;
            price = _price;

            ITokenRoot(paymentToken).deployWallet{
                value: Gas.DEPLOY_EMPTY_WALLET_VALUE,
                flag: 1,
                callback: DirectSell.onTokenWallet
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

    function onTokenWallet(address _wallet) external {
        require(msg.sender.value != 0 && msg.sender == paymentToken, DirectBuySellErrors.NOT_FROM_SPENT_TOKEN_ROOT);
        tokenWallet = _wallet;

        if (receivedNFT) {
            changeState(DirectSellStatus.Active);
        }
    }

    function getDetails() external view returns(DirectSellDetails){
        return builderDetails();
    }

    function onAcceptTokensTransfer(
        address /*token_root*/,				
        uint128 amount,					
        address sender,			 
        address /*sender_wallet*/,			
        address original_gas_to,		
        TvmCell /*payload*/					
    ) override external {
        require(msg.value >= Gas.DIRECT_SELL_INITIAL_BALANCE + Gas.DEPLOY_EMPTY_WALLET_VALUE, DirectBuySellErrors.VALUE_TOO_LOW);
        tvm.rawReserve(Gas.DIRECT_SELL_INITIAL_BALANCE, 0);
        TvmCell emptyPayload;
        if (currentStatus == DirectSellStatus.Active && 
            msg.sender.value != 0 && 
            msg.sender == tokenWallet && 
            amount >= price
            && (auctionEnd > 0 && now < auctionEnd || auctionEnd == 0) 
            )
        {
            mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
            ITIP4_1NFT(nftAddress).transfer{ 
                value: Gas.TRANSFER_OWNERSHIP_VALUE,
                flag: 1, 
                bounce: false 
            }(
                sender,
                original_gas_to,
                callbacks
            );
           
            ITokenWallet(tokenWallet).transfer{
                value: 0,
                flag: 64,
                bounce: false
            }(
                price,
                owner,
                Gas.DEPLOY_EMPTY_WALLET_GRAMS,
                original_gas_to,
                false,
                emptyPayload
            );

            IDirectSellCallback(owner).directSellSuccess(owner, sender);
            changeState(DirectSellStatus.Filled);
            
        } else {
            if (now >= auctionEnd) {
                IDirectSellCallback(owner).directSellCancelledOnTime();
                changeState(DirectSellStatus.Filled);
            }

            ITokenWallet(msg.sender).transfer{
                value: 0,
                flag: 128,
                bounce: false
            }(
                amount,
                sender,
                uint128(0),
                original_gas_to,
                true,
                emptyPayload
            );
        } 
    }

    function onNftChangeManager(
        uint256 /*id*/,
        address /*nftOwner*/,
        address /*oldManager*/,
        address newManager,
        address /*collection*/,
        address /*sendGasTo*/,
        TvmCell /*payload*/
    ) external override {
        require(newManager == address(this));
        require(msg.sender.value != 0 && msg.sender == factoryDirectSell, DirectBuySellErrors.NOT_FACTORY_MSG_SENDER_NFT);
        tvm.rawReserve(Gas.DIRECT_SELL_INITIAL_BALANCE, 0);
        receivedNFT = true;
        if (tokenWallet.value != 0) {
            changeState(DirectSellStatus.Active);
        }
    }

    function changeState(uint8 newState) private {
		uint8 prevStateN = currentStatus;
		currentStatus = newState;
		emit DirectSellStateChanged(prevStateN, newState, builderDetails());
	}

    function builderDetails() private view returns (DirectSellDetails) {
		return
			DirectSellDetails(
                factoryDirectSell,
                owner,
                paymentToken,
                nftAddress,
                timeTx,
                auctionStart,
                auctionEnd,
                price,
                tokenWallet,
                currentStatus,
                msg.sender
            );
    }

    function finishSell(
        address sendGasTo
    ) public {
        require(currentStatus == DirectSellStatus.Active, DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS);
        require(now >= auctionEnd, DirectBuySellErrors.DIRECT_SELL_IN_STILL_PROGRESS);
        require(msg.value >= Gas.FINISH_ORDER_VALUE, BaseErrors.not_enough_value);

        mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
        ITIP4_1NFT(nftAddress).changeManager { value: 0, flag: 128 }(
            owner,
            sendGasTo,
            callbacks
        );
     
        changeState(DirectSellStatus.Filled);
    }

    function closedDirectSell() external onlyOwner {
        require(currentStatus == DirectSellStatus.Active, DirectBuySellErrors.NOT_ACTIVE_CURRENT_STATUS);
        
        mapping(address => ITIP4_1NFT.CallbackParams) callbacks;
        ITIP4_1NFT(msg.sender).changeManager { value: 0, flag: 128 }(
            owner,
            owner,
            callbacks
        );
     
        changeState(DirectSellStatus.Cancelled);
    }
}