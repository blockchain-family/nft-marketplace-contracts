pragma ever-solidity >= 0.61.2;

interface IBurnTip3 {
    
    function burn(
        address user,
        address project
    ) external;
}
