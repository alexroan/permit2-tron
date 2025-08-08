const TestHashing = artifacts.require('TestHashing');

module.exports = function (deployer, network, accounts) {
  console.log('Migration running on network:', network);
  console.log('Deploying TestHashing with account:', accounts);

  // Deploy TestHashing contract
  return deployer.deploy(TestHashing);
};