pragma ever-solidity >= 0.62.0;

interface ITIP4_2JSON_Metadata {

    /// @notice metadata in JSON format
    /// @return json The JSON string with metadata
    function getJson() external view responsible returns (string json);

}