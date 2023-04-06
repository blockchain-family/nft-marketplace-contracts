pragma ever-solidity >= 0.61.2;

import "../structures/IMarketFeeStructure.sol";
import "../structures/IDiscountCollectionsStructure.sol";
import "../structures/IGasValueStructure.sol";

interface IOffersRoot is IMarketFeeStructure, IDiscountCollectionsStructure, IGasValueStructure {

    function setMarketFee(MarketFee _fee) external;
    function setMarketFeeForChildContract(address auction, MarketFee _fee) external;
    function getMarketFee() external view returns (MarketFee);

    function addCollectionsSpecialRules(address collection, CollectionFeeInfo collectionFeeInfo) external;
    function removeCollectionsSpecialRules(address collection) external;

    function getTypeContract() external pure returns (string);

    function withdraw(address tokenWallet, uint128 amount, address recipient, address remainingGasTo) external;
}
