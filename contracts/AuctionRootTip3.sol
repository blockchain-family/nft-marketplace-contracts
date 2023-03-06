pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import './abstract/OffersRoot.sol';

import './errors/BaseErrors.sol';
import './errors/AuctionErrors.sol';

import './libraries/Gas.sol';

import "./interfaces/IAuctionRootCallback.sol";
import "./interfaces/IUpgradableByRequest.sol";

import "./structures/IAuctionGasValuesStructure.sol";
import "./structures/IGasValueStructure.sol";

import './modules/TIP4_1/interfaces/INftChangeManager.sol';
import './modules/TIP4_1/interfaces/ITIP4_1NFT.sol';
import "./modules/TIP4_1/structures/ICallbackParamsStructure.sol";

import './Nft.sol';
import './AuctionTip3.sol';

contract AuctionRootTip3 is OffersRoot, INftChangeManager, ICallbackParamsStructure, IAuctionGasValuesStructure, IGasValueStructure {

    uint64 static nonce_;

    struct MarketOffer {
        address collection;
        address nftOwner;
        address nft;
        address offer;
        uint128 price;
        uint128 auctionDuration;
        uint64 deployNonce;
    }

    uint32 currentVersion;
    uint32 currentVersionOffer;

    AuctionGasValues auctionGas;

    event AuctionDeployed(address offer, MarketOffer offerInfo);
    event AuctionDeclined(address nftOwner, address nft);
    event AuctionRootUpgrade();

    address public weverVault;
    address public weverRoot;

    constructor(
        TvmCell _codeNft,
        address _owner,
        TvmCell _offerCode,
        uint128 _deploymentFee,
        MarketFee _fee,
        uint16 _auctionBidDelta,
        uint16 _auctionBidDeltaDecimals,
        address _sendGasTo,
        address _weverVault,
        address _weverRoot
    ) OwnableInternal(
        _owner
    )
        public
    {
        require(_fee.denominator > 0, BaseErrors.denominator_not_be_zero);
        tvm.accept();
        _reserve();

        // Method and properties are declared in OffersRoot
        setDefaultProperties(
            _codeNft,
            _owner,
            _offerCode,
            _deploymentFee,
            _fee,
            _auctionBidDelta,
            _auctionBidDeltaDecimals
        );
        emit MarketFeeDefaultChanged(_fee);
        currentVersion++;
        currentVersionOffer++;
        weverVault = _weverVault;
        weverRoot = _weverRoot;

        auctionGas = AuctionGasValues(
        //gasK
        valueToGas(1 ever, address(this).wid),
        // deployWallet
        GasValues(
            // fixed
            Gas.DEPLOY_EMPTY_WALLET_GRAMS +
            Gas.DEPLOY_WALLET_ROOT_COMPENSATION,
            //dynamic
            valueToGas(Gas.DEPLOY_WALLET_EXTRA_GAS, address(this).wid)
        ),
        // deployAuction
        GasValues(
            // fixed
            Gas.AUCTION_INITIAL_BALANCE +
            Gas.DEPLOY_EMPTY_WALLET_GRAMS +
            Gas.DEPLOY_WALLET_ROOT_COMPENSATION,
            //dynamic
            valueToGas(Gas.DEPLOY_WALLET_EXTRA_GAS + Gas.DEPLOY_AUCTION_EXTRA_GAS_VALUE, address(this).wid)
        ),
        //sell
        GasValues(
            // fixed
            Gas.AUCTION_ROOT_INITIAL_BALANCE +
            Gas.AUCTION_INITIAL_BALANCE +
            Gas.DEPLOY_EMPTY_WALLET_GRAMS +
            Gas.DEPLOY_WALLET_ROOT_COMPENSATION +
            Gas.FRONTENT_CALLBACK_VALUE,
            //dynamic
            valueToGas(Gas.START_AUCTION_EXTRA_GAS_VALUE + Gas.DEPLOY_WALLET_EXTRA_GAS + Gas.DEPLOY_AUCTION_EXTRA_GAS_VALUE, address(this).wid)
        ),
        //bid
        GasValues(
            // fixed
            Gas.AUCTION_INITIAL_BALANCE +
            Gas.FRONTENT_CALLBACK_VALUE +
            Gas.FRONTENT_CALLBACK_VALUE +
            Gas.TOKEN_TRANSFER_VALUE,
            //dynamic
            valueToGas(Gas.BID_EXTRA_GAS_VALUE, address(this).wid)
        ),
        // cancel
        GasValues(
            // fixed
            Gas.AUCTION_INITIAL_BALANCE +
            Gas.FRONTENT_CALLBACK_VALUE +
            Gas.NFT_CALLBACK_VALUE +
            Gas.FEE_DEPLOY_WALLET_GRAMS +
            Gas.FEE_EXTRA_VALUE +
            Gas.TOKEN_TRANSFER_VALUE +
            Gas.TRANSFER_OWNERSHIP_VALUE,
            //dynamic
            valueToGas(Gas.CANCEL_AUCTION_EXTRA_GAS_VALUE, address(this).wid)
        )
    );

        _sendGasTo.transfer({ value: 0, flag: 128, bounce: false });
    }

    function _reserve() internal override {
        tvm.rawReserve(Gas.AUCTION_ROOT_INITIAL_BALANCE, 0);
    }

    function getGasValue() external view returns (AuctionGasValues) {
        return auctionGas;
    }

    function calcValue(GasValues value) internal pure returns(uint128) {
        return value.fixedValue + gasToValue(value.dynamicGas, address(this).wid);
    }

    function getTypeContract() external pure returns (string) {
        return "AuctionRoot";
    }

    function onNftChangeManager(
        uint256 /*id*/,
        address nftOwner,
        address /*oldManager*/,
        address newManager,
        address collection,
        address sendGasTo,
        TvmCell payload
    ) external override {
        require(newManager == address(this));
        _reserve();
        bool isDeclined = false;
        uint32 callbackId = 0;

        TvmSlice payloadSlice = payload.toSlice();
        if (payloadSlice.bits() >= 32) {
            callbackId = payloadSlice.decode(uint32);
        }
        if (payloadSlice.bits() == 523) {
            (
                address paymentToken,
                uint128 price,
                uint64 auctionStartTime,
                uint64 auctionDuration
            ) = payloadSlice.decode(address, uint128, uint64, uint64);
            if (
                paymentToken.value > 0 &&
                price >= 0 &&
                auctionStartTime > 0 &&
                auctionDuration > 0 &&
                msg.value >= calcValue(auctionGas.start) &&
                msg.sender.value != 0
            ) {
                address offerAddress = new AuctionTip3 {
                    wid: address(this).wid,
                    value: calcValue(auctionGas.deployAuction),
                    flag: 1,
                    code: offerCode,
                    varInit: {
                        nonce_: tx.timestamp,
                        nft: msg.sender,
                        markerRootAddr: address(this)
                    }
                }(
                    price,
                    collection,
                    nftOwner,
                    deploymentFeePart * 2,
                    fee,
                    auctionStartTime,
                    auctionDuration,
                    auctionBidDelta,
                    auctionBidDeltaDecimals,
                    paymentToken,
                    nftOwner,
                    weverVault,
                    weverRoot,
                    auctionGas
                );

                MarketOffer offerInfo = MarketOffer(
                    collection,
                    nftOwner,
                    msg.sender,
                    offerAddress,
                    price,
                    auctionDuration,
                    tx.timestamp
                );

                emit AuctionDeployed(offerAddress, offerInfo);
                IAuctionRootCallback(nftOwner).auctionTip3DeployedCallback{
                     value: Gas.FRONTENT_CALLBACK_VALUE,
                     flag: 1,
                     bounce: false
                }(
                    callbackId,
                    offerAddress,
                    offerInfo
                );

                mapping(address => CallbackParams) callbacks;
                ITIP4_1NFT(msg.sender).changeManager{ value: 0, flag: 128 }(
                    offerAddress,
                    sendGasTo,
                    callbacks
                );
            } else {
                isDeclined = true;
            }
        } else {
            isDeclined = true;
        }

        if (isDeclined) {
            emit AuctionDeclined(nftOwner, msg.sender);
            IAuctionRootCallback(nftOwner).auctionTip3DeployedDeclined{
                value: Gas.FRONTENT_CALLBACK_VALUE,
                flag: 1,
                bounce: false
            }(
                callbackId,
                nftOwner,
                msg.sender
            );

            mapping(address => CallbackParams) callbacks;
            ITIP4_1NFT(msg.sender).changeManager{ value: 0, flag: 128 }(
                nftOwner,
                sendGasTo,
                callbacks
            );
        }
    }

    function getOfferAddress(
        address _nft,
        uint64 _nonce
    )
        internal
        view
        returns (address)
    {
        TvmCell data = tvm.buildStateInit({
            contr: AuctionTip3,
            code: offerCode,
            varInit: {
                nonce_: _nonce,
                nft: _nft
            }
        });

        return address(tvm.hash(data));
    }

    function buildAuctionCreationPayload(
        uint32 callbackId,
        address paymentToken,
        uint128 price,
        uint64 auctionStartTime,
        uint64 auctionDuration
    ) external pure responsible returns(TvmCell) {
        TvmBuilder builder;
        builder.store(callbackId);
        builder.store(paymentToken);
        builder.store(price);
        builder.store(auctionStartTime);
        builder.store(auctionDuration);
        return { value: 0, bounce: false, flag: 64 } builder.toCell();
    }

    function withdraw(address tokenWallet, uint128 amount, address recipient, address remainingGasTo) external onlyOwner {
        require(recipient.value != 0, AuctionErrors.wrong_recipient);
        require(msg.value >= Gas.WITHDRAW_VALUE, AuctionErrors.low_gas);
        _reserve();
        TvmCell emptyPayload;
        ITokenWallet(tokenWallet).transfer{ value: 0, flag: 128, bounce: false }
            (amount, recipient, Gas.DEPLOY_EMPTY_WALLET_GRAMS, remainingGasTo, false, emptyPayload);
        emit MarketFeeWithdrawn(recipient, amount, tokenWallet);
    }

    function RequestUpgradeAuction(
        address _nft,
        uint64 _nonce,
        address sendGasTo
    ) external view onlyOwner {
        require(msg.value >= Gas.UPGRADE_AUCTION_ROOT_MIN_VALUE, BaseErrors.value_too_low);
        tvm.rawReserve(math.max(
            Gas.AUCTION_ROOT_INITIAL_BALANCE,
            address(this).balance - msg.value), 2
        );

        IUpgradableByRequest(getOfferAddress(_nft, _nonce)).upgrade{
            value: 0,
            flag: 128
        }(offerCode, currentVersionOffer, sendGasTo);
    }

    function upgradeOfferCode(TvmCell newCode) public onlyOwner {
        _reserve();
        offerCode = newCode;
        currentVersionOffer++;

        msg.sender.transfer(
            0,
            false,
            128 + 2
        );
    }

    function upgrade(
        TvmCell newCode,
        uint32 newVersion,
        address sendGasTo
    ) external onlyOwner {
        if (currentVersion == newVersion) {
            _reserve();
            sendGasTo.transfer({
                value: 0,
                flag: 128 + 2,
                bounce: false
            });
		} else {
            emit AuctionRootUpgrade();

            TvmCell cellParams = abi.encode(
                nonce_,
                owner(),
                currentVersion,
                currentVersionOffer,
                auctionBidDelta,
                auctionBidDeltaDecimals,
                codeNft,
                offerCode,
                deploymentFee,
                fee,
                deploymentFeePart,
                weverVault,
                weverRoot,
                auctionGas
            );

            tvm.setcode(newCode);
            tvm.setCurrentCode(newCode);

            onCodeUpgrade (cellParams);
        }
    }

    function onCodeUpgrade(TvmCell data) private {}
}
