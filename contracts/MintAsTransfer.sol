pragma ton-solidity =0.57.1;

pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenWallet.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/IAcceptTokensMintCallback.sol";

contract MintAsTransfer is IAcceptTokensMintCallback {

    uint32 static nonce_;

    constructor() public {
        tvm.accept();
        tvm.rawReserve(1 ton, 0);
    }

    function buildPayload(
        address dest,
        uint128 deployWalletVaule,
        TvmCell transferPayload
    ) external pure returns (TvmCell) {
        TvmBuilder builder;
        builder.store(dest);
        builder.store(deployWalletVaule);
        builder.store(transferPayload);
        return builder.toCell();
    }

    function onAcceptTokensMint(
        address /*tokenRoot*/,
        uint128 amount,
        address user,
        TvmCell payload
    ) override external {
        tvm.rawReserve(1 ton, 0);

        TvmSlice payloadSlice = payload.toSlice();

        if (payloadSlice.bits() == 395 && payloadSlice.refs() == 1) {

            (address dest, uint128 deployWalletValue) = payloadSlice.decode(address, uint128);
            TvmCell transferPayload = payloadSlice.loadRef();

            ITokenWallet(msg.sender).transfer{ value: 0, flag: 128, bounce: false }(
                amount,
                dest,
                deployWalletValue,
                user,
                true,
                transferPayload
            );
        } else {
            TvmCell empty;
            ITokenWallet(msg.sender).transfer{ value: 0, flag: 128, bounce: false }(
                amount,
                user,
                0.1 ton,
                user,
                true,
                empty
            );
        }
    }
}
