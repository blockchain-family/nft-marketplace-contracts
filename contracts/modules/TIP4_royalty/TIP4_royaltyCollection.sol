pragma ever-solidity ^0.61.2;

pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;

import "./interfaces/IRoyaltyInfo.sol";
import "./structures/IRoyaltyStructure.sol";
import "../TIP4_1/TIP4_1Collection.sol";


abstract contract TIP4_royaltyCollection is TIP4_1Collection, IRoyaltyInfo, IRoyaltyStructure {

	Royalty private _royalty;

    constructor(
        Royalty royalty
    ) public {
        _royalty = royalty;

        _supportedInterfaces[
            bytes4(tvm.functionId(IRoyaltyInfo.royaltyInfo))
        ] = true;
    }

    function royaltyInfo(
        uint128 salePrice
    )
        external
        view
        responsible
        override
        returns(address receiver, uint128 currentRoyalty)
    {
        uint128 amount = math.muldivc(salePrice, _royalty.numerator, _royalty.denominator);
        return {value: 0, flag: 128, bounce: false} (_royalty.receiver, amount);
    }
}
