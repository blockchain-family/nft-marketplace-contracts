pragma ever-solidity >= 0.61.2;

pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;

import "./interfaces/IAcceptNftBurnCallback.sol";
import "./interfaces/IBurnableCollection.sol";

import "./modules/TIP4_2/TIP4_2Collection.sol";
import "./modules/TIP4_3/TIP4_3Collection.sol";
import "./modules/access/OwnableInternal.sol";

import "./Nft.sol";

contract Collection is TIP4_2Collection, TIP4_3Collection, IBurnableCollection, OwnableInternal {

	uint64 static nonce_;

	uint8 constant value_is_less_than_required = 104;

	/// _remainOnNft - the number of EVERs that will remain after the entire mint
	/// process is completed on the Nft contract
	uint128 _remainOnNft;
	uint256 _totalMinted;

	constructor(
		TvmCell codeNft,
		TvmCell codeIndex,
		TvmCell codeIndexBasis,
		address owner,
		uint128 remainOnNft,
		string json
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
	}

	function mintNft(address _owner, string _json) public virtual onlyOwner {
		require(
			msg.value > _remainOnNft + _indexDeployValue * 2 + 0.3 ever,
			value_is_less_than_required
		);
		tvm.rawReserve(1 ever, 0);
		_mintNft(_owner, _json, 0, 128);
	}

	function totalMinted() external view responsible returns (uint256 count) {
		return {value: 0, flag: 64, bounce: false} (_totalMinted);
	}

	function batchMintNft(address _owner, string[] _jsons) public virtual onlyOwner {
		require(
			msg.value > (_remainOnNft + 3 ever) * _jsons.length + 1 ever,
			value_is_less_than_required
		);
		tvm.rawReserve(1 ever, 0);

		for ((string _json) : _jsons) {
			_mintNft(_owner, _json, 3 ever, 0);
		}
	}


	function _mintNft(address owner, string json, uint128 value, uint16 flag) internal virtual {

		uint256 id = uint256(_totalMinted);
		_totalMinted++;
		_totalSupply++;

		TvmCell codeNft = _buildNftCode(address(this));
		TvmCell stateNft = _buildNftState(codeNft, id);
		address nftAddr = new Nft{stateInit: stateNft, value: value, flag: flag}(
			owner,
			msg.sender,
			_remainOnNft,
			json,
			_indexDeployValue,
			_indexDestroyValue,
			_codeIndex
		);

		emit NftCreated(id, nftAddr, owner, msg.sender, msg.sender);
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

	function acceptNftBurn(
		uint256 _id,
		address _owner,
		address _manager,
		address _sendGasTo,
		address _callbackTo,
		TvmCell _callbackPayload
	) external override {
		require(msg.sender.value != 0 && _resolveNft(_id) == msg.sender, 100);

		_totalSupply--;
		emit NftBurned(_id, msg.sender, _owner, _manager);

		if (_callbackTo.value != 0) {
			IAcceptNftBurnCallback(_callbackTo).onAcceptNftBurn{
				value: 0,
				flag: 64 + 2,
				bounce: false
			}(
				address(this),
				_id,
				msg.sender,
				_owner,
				_manager,
				_sendGasTo,
				_callbackPayload
			);
		} else {
			_sendGasTo.transfer({
				value: 0,
				flag: 64 + 2,
				bounce: false
			});
		}
	}
}
