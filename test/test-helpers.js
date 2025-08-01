const { TronWeb } = require('tronweb');

// Polyfill for fetch in Node.js
if (typeof fetch === 'undefined') {
  global.fetch = async (url) => {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            text: async () => data,
            json: async () => JSON.parse(data),
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode
          });
        });
      });

      req.on('error', reject);
    });
  };
}

// Fetch accounts from TRE container
const fetchAccountsFromContainer = async () => {
  try {
    const response = await fetch('http://127.0.0.1:9095/admin/accounts?format=all');

    if (!response.ok) {
      throw new Error(`TRE container API returned status ${response.status}`);
    }

    const text = await response.text();

    // Parse the response to extract accounts
    const accounts = {};
    const lines = text.split('\n');

    // Extract base58 addresses and balances
    const addressMatches = [];
    const privateKeyMatches = [];

    // Parse base58 addresses (format: "(0) TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC (98999909498.81531 TRX)")
    for (const line of lines) {
      const addressMatch = line.match(/^\((\d+)\)\s+([A-Za-z0-9]+)\s+\(([\d,.]+)\s+TRX\)$/);
      if (addressMatch) {
        const [, index, address, balance] = addressMatch;
        addressMatches[parseInt(index)] = { address, balance: parseFloat(balance.replace(/,/g, '')) };
      }

      // Parse private keys (format: "(0) 0000000000000000000000000000000000000000000000000000000000000001")
      const keyMatch = line.match(/^\((\d+)\)\s+([0-9a-f]{64})$/);
      if (keyMatch) {
        const [, index, privateKey] = keyMatch;
        privateKeyMatches[parseInt(index)] = privateKey;
      }
    }

    // Build account objects for first 3 accounts
    const accountNames = ['owner', 'second', 'third'];
    for (let i = 0; i < 3; i++) {
      if (!addressMatches[i] || !privateKeyMatches[i]) {
        throw new Error(`Failed to parse account ${i} from TRE container response.`);
      }

      accounts[accountNames[i]] = {
        privateKey: privateKeyMatches[i],
        address: addressMatches[i].address,
        balance: addressMatches[i].balance
      };
    }

    console.log('Successfully fetched accounts from TRE container:');
    console.log(`Owner: ${accounts.owner.address} (${accounts.owner.balance} TRX)`);
    console.log(`Second: ${accounts.second.address} (${accounts.second.balance} TRX)`);
    console.log(`Third: ${accounts.third.address} (${accounts.third.balance} TRX)`);

    return accounts;
  } catch (error) {
    console.error('FATAL: Failed to fetch accounts from TRE container:', error.message);
    console.error('Make sure the TRE container is running at http://127.0.0.1:9095');
    throw new Error(`Cannot fetch dynamic accounts from TRE container: ${error.message}`);
  }
};

// Network configuration
const NETWORK_CONFIG = {
  fullHost: 'http://127.0.0.1:9095',
  userFeePercentage: 0,
  feeLimit: 1000 * 1e6,
  network_id: '9'
};

// Initialize accounts as null
let testAccounts = null;

// TronWeb instances
let tronWebInstances = {
  owner: null,
  second: null,
  third: null
};

// Setup accounts - must be called before tests
const setupAccounts = async () => {
  // Fetch accounts from container
  testAccounts = await fetchAccountsFromContainer();

  // Create TronWeb instances for each account
  for (const [name, account] of Object.entries(testAccounts)) {
    if (name === 'zeroAddress') continue;
    
    tronWebInstances[name] = new TronWeb({
      fullHost: NETWORK_CONFIG.fullHost,
      privateKey: account.privateKey
    });
  }

  console.log('TronWeb instances created for all accounts');
};

// Get TronWeb instance for contract deployment
const getTronWebInstance = async (Contract, accountName = 'owner') => {
  if (!tronWebInstances[accountName]) {
    throw new Error(`TronWeb instance for ${accountName} not found. Call setupAccounts() first.`);
  }

  const tronWeb = tronWebInstances[accountName];
  tronWeb.setAddress(testAccounts[accountName].address);
  
  // Load contract ABI and bytecode
  const contractInfo = Contract._json || Contract;
  
  // Deploy contract
  const contract = await tronWeb.contract().new({
    abi: contractInfo.abi,
    bytecode: contractInfo.bytecode,
    feeLimit: NETWORK_CONFIG.feeLimit,
    callValue: 0,
    userFeePercentage: NETWORK_CONFIG.userFeePercentage,
    from: testAccounts[accountName].address
  });

  return contract;
};

// Deploy contract and get instance
const deployContract = async (tronWeb, contractJson, ...args) => {
  const contract = await tronWeb.contract().new({
    abi: contractJson.abi,
    bytecode: contractJson.bytecode,
    feeLimit: NETWORK_CONFIG.feeLimit,
    callValue: 0,
    userFeePercentage: NETWORK_CONFIG.userFeePercentage,
    parameters: args
  });

  return contract;
};

// Get existing contract instance
const getContractAt = async (tronWeb, contractJson, address) => {
  return await tronWeb.contract(contractJson.abi, address);
};

module.exports = {
  setupAccounts,
  getTronWebInstance,
  deployContract,
  getContractAt,
  get accounts() { return testAccounts; },
  ownerWeb: () => tronWebInstances.owner,
  secondWeb: () => tronWebInstances.second,
  thirdWeb: () => tronWebInstances.third,
  NETWORK_CONFIG
}; 