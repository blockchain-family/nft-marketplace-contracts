pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./modules/TIP4_1/interfaces/INftChangeManager.sol";
import "./modules/TIP4_1/interfaces/INftChangeOwner.sol";
import "./modules/TIP4_1/interfaces/INftTransfer.sol";
import "./interfaces/IAuctionBidPlacedCallback.sol";
import "./interfaces/IAuctionRootCallback.sol";
import "./interfaces/IDirectBuyCallback.sol";
import "./interfaces/IDirectSellCallback.sol";

contract Callbacks is
    INftChangeManager,
    INftChangeOwner,
    INftTransfer,
    IAuctionBidPlacedCallback,
    IAuctionRootCallback,
    IDirectBuyCallback,
    IDirectSellCallback
{

    function onNftChangeManager(
        uint256 id,
        address owner,
        address oldManager,
        address newManager,
        address collection,
        address sendGasTo,
        TvmCell payload
    ) external override {

    }

    function onNftChangeOwner(
        uint256 id,
        address manager,
        address oldOwner,
        address newOwner,
        address collection,
        address sendGasTo,
        TvmCell payload
    ) external override {

    }

    function onNftTransfer(
        uint256 id,
        address oldOwner,
        address newOwner,
        address oldManager,
        address newManager,
        address collection,
        address gasReceiver,
        TvmCell payload
    ) external override {

    }

    function bidPlacedCallback(
        uint32 callbackId,
        uint128 nextBidValue,
        address nft
    ) external override {

    }

    function bidNotPlacedCallback(
        uint32 callbackId,
        address nft
    ) external override {

    }

    function bidRaisedCallback(
        uint32 callbackId,
        address newBidAddr,
        uint128 newBidValue,
        address nft
    ) external override {

    }

    function auctionComplete(
        uint32 callbackId,
        address nft
    ) external override {

    }

    function auctionCancelled(
        uint32 callbackId,
        address nft
    ) external override {

    }


    function auctionTip3DeployedCallback(
        uint32 callbackId,
        address offer,
        AuctionRootTip3.MarketOffer offerInfo
    ) external override {

    }

    function auctionTip3DeployedDeclined(
        uint32 callbackId,
        address nftOwner,
        address nft
    ) external override {

    }

    function directBuyDeployed(
        uint32 callbackId,
        address directBuy,
        address sender,
        address token,
        address nft,
        uint64 nonce,
        uint128 amount
    ) external override {

    }

    function directBuyDeployedDeclined(
        uint32 callbackId,
        address sender,
        address token,
        uint128 amount,
        address nft
    ) external override {

    }

    function directBuySuccess(
        uint32 callbackId,
        address oldOwner,
        address newOwner,
        address nft
    ) external override {

    }

    function directBuyNotSuccess(
        uint32 callbackId,
        address nft
    ) external override {

    }

    function directBuyCancelledOnTime(
        uint32 callbackId,
        address nft
    ) external override {

    }

    function directBuyClose(
        uint32 callbackId,
        address nft
    ) external override {

    }

    function directSellDeployed(
        uint32 callbackId,
        address directSell,
        address sender,
        address paymentToken,
        address nft,
        uint64 nonce,
        uint128 price
    ) external override {

    }

    function directSellDeclined(
        uint32 callbackId,
        address sender,
        address nft
    ) external override {

    }

    function directSellSuccess(
        uint32 callbackId,
        address oldOwner,
        address newOwner,
        address nft
    ) external override {

    }

    function directSellNotSuccess(
        uint32 callbackId,
        address nft
    ) external override {

    }

    function directSellCancelledOnTime(
        uint32 callbackId,
        address nft
    ) external override {

    }

    function directSellClose(
        uint32 callbackId,
        address nft
    ) external override {

    }
}
