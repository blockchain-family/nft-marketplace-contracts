pragma ever-solidity >= 0.61.2;

import "../structures/IRoyaltyStructure.sol";
import "../interfaces/IRoyaltyInfo.sol";
import "../abstract/BaseOffer.sol";
import "../libraries/Gas.sol";
import "../modules/TIP4_1/interfaces/ITIP4_1NFT.sol";
import "../interfaces/IEventsRoyalty.sol";
import "tip3/contracts/interfaces/ITokenWallet.sol";

abstract contract RoyaltyOffer is IRoyaltyStructure,IEventsRoyalty, BaseOffer {

    uint128 private constant DENOMINATOR = 1000000000;

    function royalty() external view returns (optional(Royalty)) {
        return _getRoyalty();
    }

    function _checkRoyaltyFromNFT(uint128 gasValue) internal view {
       IRoyaltyInfo(_getNftAddress()).royaltyInfo{
            value: gasValue,
            flag: 0,
            callback: RoyaltyOffer.onRoyaltyNFTInfo
        }(DENOMINATOR);
    }

    function _fallbackRoyaltyFromCollection(
        uint32 _functionId
    ) internal {
        if (_functionId == tvm.functionId(IRoyaltyInfo.royaltyInfo)) {
            if (msg.sender == _getNftAddress()) {
                if (_getCollection().value !=0) {
                    IRoyaltyInfo(_getCollection()).royaltyInfo{
                        value: Gas.GET_ROYALTY_INFO_VALUE,
                        flag: 0,
                        callback: RoyaltyOffer.onRoyaltyCollectionInfo
                    }(DENOMINATOR);
                } else {
                    ITIP4_1NFT(_getNftAddress()).getInfo{
                        value: Gas.GET_INFO_VALUE,
                        flag: 0,
                        callback: RoyaltyOffer.onGetInfoRoyalty
                    }();
                }
            } else if (msg.sender == _getCollection()) {
                _setRoyalty(Royalty(0, DENOMINATOR, address(0)));
                _afterSetRoyalty();
            }
        }
    }

    function onGetInfoRoyalty(
        uint256, /*id*/
        address, /*owner*/
        address, /*manager*/
        address _collection
    ) external {
        require(msg.sender.value != 0 && msg.sender == _getNftAddress(), BaseErrors.operation_not_permited);
        _setCollection(_collection);
        IRoyaltyInfo(_getCollection()).royaltyInfo{
            value: Gas.GET_ROYALTY_INFO_VALUE,
            flag: 0,
            callback: RoyaltyOffer.onRoyaltyCollectionInfo
        }(DENOMINATOR);
    }

    function _afterSetRoyalty() internal virtual;
    function _isAllowedSetRoyalty() internal virtual returns (bool);

    function onRoyaltyCollectionInfo(
        address _receiver,
        uint128 _amount
    ) external {
        require(msg.sender.value != 0 && msg.sender == _getCollection(), BaseErrors.operation_not_permited);
        if (_isAllowedSetRoyalty()) {
            _setRoyalty(Royalty(_amount, DENOMINATOR, _receiver));
            _afterSetRoyalty();
        }
    }

    function onRoyaltyNFTInfo(
        address _receiver,
        uint128 _amount
    ) external {
        require(msg.sender.value != 0 && msg.sender == _getNftAddress(), BaseErrors.operation_not_permited);
        if (_isAllowedSetRoyalty()) {
            _setRoyalty(Royalty(_amount, DENOMINATOR, _receiver));
            _afterSetRoyalty();
        }
    }

    function _getRoyaltyAmount(uint128 _currentFee, uint128 _price) internal returns (uint128) {
        return math.muldivc((_price - _currentFee), _getRoyalty().get().numerator, _getRoyalty().get().denominator);
    }

    function _retentionRoyalty(
        uint128 _amount,
        address _tokenWallet,
        address _remainingGasTo
    ) internal view {
        TvmCell emptyPayload;
        emit RoyaltyWithdrawn(_getRoyalty().get().receiver, _amount, _getPaymentToken());
        ITokenWallet(_tokenWallet).transfer{
            value: Gas.ROYALTY_DEPLOY_WALLET_GRAMS + Gas.ROYALTY_EXTRA_VALUE,
            flag: 0,
            bounce: false
        }(
            _amount,
            _getRoyalty().get().receiver,
            Gas.ROYALTY_DEPLOY_WALLET_GRAMS,
            _remainingGasTo,
            false,
            emptyPayload
        );
    }
}