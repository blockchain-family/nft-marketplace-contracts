pragma ever-solidity >= 0.61.2;

interface INftInfoStructure {
    struct Attributes {
        string trait_type;
        string  value;
    }

    struct NftInfo {
        string name;
        string description;
        string previewUrl;
        string previewMimeType;
        string fileUrl;
        string fileMimeType;
        Attributes[] attributes;
        string externalUrl;
    }
}
