pragma ever-solidity ^0.61.2;

pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;

import "./interfaces/IRoyaltyInfo.tsol";
import "./structures/IRoyaltyStructure.tsol";

import "../TIP4_1/TIP4_1Nft.tsol";

abstract contract TIP4_royaltyNft is TIP4_1Nft, IRoyaltyInfo, IRoyaltyStructure {

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
        returns(address receiver, uint128 royaltyAmount)
    {
        uint128 amount = math.muldivc(salePrice, _royalty.numerator, _royalty.denominator);
        return {value: 0, flag: 128, bounce: false} (_royalty.receiver, amount);
    }
}