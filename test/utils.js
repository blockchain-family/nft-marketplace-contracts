//import BigNumber from "bignumber.js";
const logger = require('mocha-logger');


const isValidTonAddress = (address) => /^(?:-1|0):[0-9a-fA-F]{64}$/.test(address);

module.exports = {
 isValidTonAddress
}