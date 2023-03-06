pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;

import "./modules/TIP4_2/TIP4_2Collection.sol";
import "./modules/TIP4_3/TIP4_3Collection.sol";
import "./modules/access/OwnableInternal.sol";
import "./structures/INftInfoStructure.sol";
import "./errors/BaseErrors.sol";
import "./libraries/NftJson.sol";

import "./Nft.sol";

contract CollectionSimilar is TIP4_2Collection, TIP4_3Collection, OwnableInternal, INftInfoStructure {

	uint64 static nonce_;

	/// _remainOnNft - the number of EVERs that will remain after the entire mint
	/// process is completed on the Nft contract
	uint128 _remainOnNft;
	NftInfo[] public _patterns;

	constructor(
		TvmCell codeNft,
		TvmCell codeIndex,
		TvmCell codeIndexBasis,
		address owner,
		uint128 remainOnNft,
		string json,
		NftInfo[] patterns
	)
		public
		OwnableInternal(owner)
		TIP4_1Collection(codeNft)
		TIP4_2Collection(json)
		TIP4_3Collection(codeIndex, codeIndexBasis)
	{
		tvm.accept();
		tvm.rawReserve(1 ever, 0);
		_remainOnNft = remainOnNft;
		_patterns = patterns;
	}

	function mintNft(address _owner, uint256 _id, address _sendGasTo) public virtual onlyOwner {
		require(
			msg.value >= _remainOnNft + _indexDeployValue * 2 + 0.3 ever,
			BaseErrors.value_too_low
		);
		tvm.rawReserve(1 ever, 0);
		_mintNft(_owner, _id, _sendGasTo);
	}

	function _mintNft(address _owner, uint256 _id, address _sendGasTo) internal virtual {
		_totalSupply++;

		TvmCell codeNft = _buildNftCode(address(this));
		TvmCell stateNft = _buildNftState(codeNft, _id);
		address nftAddr = new Nft{stateInit: stateNft, value: 0, flag: 128}(
			_owner,
			_sendGasTo,
			_remainOnNft,
			NftJson.buildJson(_id, _patterns[_id % _patterns.length]),
			_indexDeployValue,
			_indexDestroyValue,
			_codeIndex
		);

		emit NftCreated(_id, nftAddr, _owner, _owner, msg.sender);
	}

	function setRemainOnNft(uint128 remainOnNft) external virtual onlyOwner {
		_remainOnNft = remainOnNft;
	}

	function _buildNftState(TvmCell code, uint256 id)
		internal
		pure
		virtual
		override (TIP4_2Collection, TIP4_3Collection)
		returns (TvmCell)
	{
		return tvm.buildStateInit({contr: Nft, varInit: {_id: id}, code: code});
	}

	function resolveIndexCodeHash(address collection, address owner) public view returns (uint256 hash) {
		TvmCell code = _buildIndexCode(collection, owner);
		return tvm.hash(code);
	}
}
