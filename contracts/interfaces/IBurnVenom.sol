pragma ever-solidity >= 0.61.2;

interface IBurnVenom {
    
    function burn(
        address user,
        address project
    ) external;
}
