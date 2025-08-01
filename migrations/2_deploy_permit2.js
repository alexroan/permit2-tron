const Permit2 = artifacts.require('./Permit2.sol');

module.exports = function (deployer) {
  deployer.deploy(Permit2);
};
