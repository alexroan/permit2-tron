const MockERC20 = artifacts.require('MockERC20');

module.exports = function (deployer, network, accounts) {
  console.log('Migration running on network:', network);
  console.log('Deploying MockERC20 with account:', accounts);

  // Deploy MockERC20 contract
  return deployer.deploy(MockERC20, 'MockERC20', 'MCK');
};
