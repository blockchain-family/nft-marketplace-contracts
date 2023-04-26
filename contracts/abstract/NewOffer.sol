pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import '../errors/BaseErrors.sol';
import '../errors/OffersBaseErrors.sol';

import '../interfaces/IOffersRoot.sol';
import "../interfaces/IOffer.sol";
import "../interfaces/IEventsMarketFeeOffer.sol";

abstract contract Offer is IOffer, IEventsMarketFeeOffer {

    address public nftOwner;
    address private markerRootAddress;
    address private paymentToken;

    constructor(
        address _nftOwner,
        address _markerRootAddress,
        address paymentToken
    ) public
    {
        nftOwner = _nftOwner;
        markerRootAddress = _markerRootAddress;
    }

    function _getMarketRootAddress() internal view virtual returns(address){
          return markerRootAddress;
    }

    function _getPaymentToken() internal view virtual returns(address){
          return paymentToken;
    }

    modifier onlyOwner() {
        require(
            msg.sender.value != 0 &&
            msg.sender == nftOwner, 
            BaseErrors.message_sender_is_not_my_owner
        );
        _;
    }

    function _reserve() internal virtual;


    function calcValue(IGasValueStructure.GasValues value) internal pure returns(uint128) {
        return value.fixedValue + gasToValue(value.dynamicGas, address(this).wid);
    }

    function _resolveNft(uint256 _id) internal view returns (address) {
        TvmCell data = tvm.buildDataInit({
            contr: TIP4_1Nft,
            varInit: {_id: _id},
            pubkey: 0
        });
        uint256 dataHash = tvm.hash(data);
        uint16 dataDepth = data.depth();
        uint256 hash = tvm.stateInitHash(discontOpt.get().feeInfo.codeHash, dataHash, discontOpt.get().feeInfo.codeDepth, dataDepth);
        return address.makeAddrStd(address(this).wid, hash);
    }

    function onGetInfo(
        uint256 _id,
        address _owner,
        address _manager,
        address _collection
    ) external {
        require(msg.sender.value != 0 && msg.sender == discountNft, BaseErrors.operation_not_permited);
        if (_owner == nftOwner && _collection == discontOpt.get().collection && discontOpt.hasValue()) {
            fee = MarketFee(discontOpt.get().feeInfo.numerator, discontOpt.get().feeInfo.denominator);
            emit MarketFeeChanged(address(this), fee);
        }
    }

    onBounce(TvmSlice body) external {
        _reserve();
        uint32 functionId = body.decode(uint32);
        if (functionId == tvm.functionId(IRoyalty.royaltyInfo)) {
            if (msg.sender == nftAddress) {
                (royaltyNumerator, royaltyReceiver) = IRoyalty(collection).royaltyInfo(price);
            }
        }
        nftOwner.transfer({ value: 0, flag: 128 + 2, bounce: false });
    }



}
