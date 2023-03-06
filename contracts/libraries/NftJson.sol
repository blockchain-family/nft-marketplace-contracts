pragma ever-solidity >= 0.61.2;

import "../structures/INftInfoStructure.sol";

library NftJson {

    function buildJson(uint256 _nftId, INftInfoStructure.NftInfo _nftInfo) public pure returns(string) {
		return "{" +
			"\"type\": \"Basic NFT\", " +
			"\"id\":" + format("{}", _nftId) + ", " +
			"\"name\": \"" + _nftInfo.name + " " + format("{}", _nftId) + "\", " +
			"\"description\": \"" + _nftInfo.description  + "\", " +
			"\"preview\": {" +
				"\"source\": \"" + _nftInfo.previewUrl + "\", " +
				"\"mimetype\": \"" + _nftInfo.previewMimeType +  "\"" +
			"}, " +
			"\"files\": [" +
				"{" +
					"\"source\": \"" + _nftInfo.fileUrl + "\", " +
					"\"mimetype\" : \"" + _nftInfo.fileUrl +  "\"" +
				"}" +
			"], " +
			"\"attributes\":" + buildAttributes(_nftInfo.attributes) + "," +
			"\"external_url\": \"" + _nftInfo.externalUrl + "\"" +
		"}";
    }

	function buildAttributes(INftInfoStructure.Attributes[] attributes) public pure returns(string) {
		string strFromAttributes = "[";
		uint256 attLength = attributes.length;
		uint256 count = 1;
		for (INftInfoStructure.Attributes attr: attributes) {
			strFromAttributes += "{ \"trait_type\": \"" + attr.trait_type +
			"\" ,\"value\": \"" + attr.value + "\"}";

			if (count < attLength){
				strFromAttributes += ",";
			}
			count++;
		}
		return strFromAttributes + "]";

	}
}
