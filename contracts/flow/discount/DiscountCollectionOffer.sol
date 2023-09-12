pragma ever-solidity >= 0.61.2;

import "../../abstract/BaseOffer.sol";

import "../../structures/IMarketFeeStructure.sol";
import "../../structures/IDiscountCollectionsStructure.sol";

import "../../modules/TIP4_1/TIP4_1Nft.sol";

import "../../libraries/Gas.sol";

import "../../errors/BaseErrors.sol";

abstract contract DiscountCollectionOffer is BaseOffer {

    function onGetInfoDiscount(
        uint256 _id,
        address _owner,
        address _manager,
        address _collection
    )
        external
    {
        require(
            msg.sender.value != 0 &&
            msg.sender == _getDiscountNft(),
            BaseErrors.operation_not_permited
        );
        DiscountInfo discountOpt = _getDiscountOpt().get();
        if (
            _owner == _getOwner() &&
            _collection == discountOpt.collection &&
            _getDiscountOpt().hasValue()
        ) {
            _setMarketFee(
                MarketFee(
                    discountOpt.feeInfo.numerator,
                    discountOpt.feeInfo.denominator
                )
            );
        }
    }

    function _discountAvailabilityCheck()
        internal
    {
        DiscountInfo discountOpt = _getDiscountOpt().get();
        TvmCell data = tvm.buildDataInit({
            contr: TIP4_1Nft,
            varInit: {_id: discountOpt.nftId},
            pubkey: 0
        });
        uint256 dataHash = tvm.hash(data);
        uint16 dataDepth = data.depth();
        _setDiscountNft(
            _resolveNft(
                discountOpt.feeInfo.codeHash,
                discountOpt.feeInfo.codeDepth,
                dataHash,
                dataDepth
            )
        );
        ITIP4_1NFT(_getDiscountNft().get()).getInfo{
            value: Gas.GET_INFO_VALUE,
            flag: 0,
            callback: DiscountCollectionOffer.onGetInfoDiscount
        }();
    }

    function _resolveNft(
        uint256 codeHash,
        uint16 codeDepth,
        uint256 dataHash,
        uint16 dataDepth
    )
        internal
        pure
        returns (address)
    {
        uint256 hash = tvm.stateInitHash(codeHash, dataHash, codeDepth, dataDepth);
        return address.makeAddrStd(address(this).wid, hash);
    }
}