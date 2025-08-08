/**
 * Permit Helper Functions for Permit2 on Tron
 * 
 * These helper functions assist in preparing data for Permit2 operations.
 * They focus on data preparation and hash generation, leaving signing to the caller.
 */

const hashHelpers = require('./hash-helpers');

/**
 * Creates a properly formatted permit structure
 * @param {string} token - Token address
 * @param {string|number} amount - Amount to permit
 * @param {string} spender - Address that will be permitted to spend
 * @param {number} nonce - Unique nonce for this permit
 * @param {number} deadline - Unix timestamp when permit expires
 * @returns {Object} Formatted permit object
 */
function createPermit(token, amount, spender, nonce, deadline) {
  return {
    permitted: {
      token: token,
      amount: amount.toString()
    },
    spender: spender,
    nonce: nonce,
    deadline: deadline
  };
}

/**
 * Creates transfer details structure
 * @param {string} to - Recipient address
 * @param {string|number} requestedAmount - Amount to transfer
 * @returns {Object} Formatted transfer details
 */
function createTransferDetails(to, requestedAmount) {
  return {
    to: to,
    requestedAmount: requestedAmount.toString()
  };
}

/**
 * Generates the hash for permitTransferFrom (ready for signing)
 * @param {Object} tronWeb - TronWeb instance
 * @param {Object} permit - Permit object from createPermit
 * @param {string} domainSeparator - Domain separator from the contract
 * @returns {Object} Object containing structHash and finalHash
 */
function getPermitTransferFromHash(tronWeb, permit, domainSeparator) {
  // Type hashes
  const TOKEN_PERMISSIONS_TYPEHASH = '0x' + tronWeb.sha3('TokenPermissions(address token,uint256 amount)', false);
  const PERMIT_TRANSFER_FROM_TYPEHASH = '0x' + tronWeb.sha3(
    'PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)', 
    false
  );
  
  // Step 1: Hash token permissions
  const tokenPermissionsHash = hashHelpers.hashTokenPermissions(
    tronWeb,
    permit.permitted.token,
    permit.permitted.amount,
    TOKEN_PERMISSIONS_TYPEHASH
  );
  
  // Step 2: Convert spender to uint160 for encoding
  const spenderHex = permit.spender.startsWith('0x') ? permit.spender : tronWeb.address.toHex(permit.spender);
  const spenderWithout41 = '0x' + spenderHex.slice(2);
  const spenderBigInt = BigInt(spenderWithout41).toString();
  
  // Step 3: Encode the permit struct
  const permitEncoded = tronWeb.utils.abi.encodeParams(
    ['bytes32', 'bytes32', 'uint160', 'uint256', 'uint256'],
    [PERMIT_TRANSFER_FROM_TYPEHASH, tokenPermissionsHash, spenderBigInt, permit.nonce, permit.deadline]
  );
  
  // Step 4: Hash the encoded struct
  const structHash = tronWeb.utils.ethersUtils.keccak256(permitEncoded);
  
  // Step 5: Create final hash using TIP-712
  const finalHash = hashHelpers.hashTypedData(
    tronWeb,
    domainSeparator,
    structHash
  );
  
  return {
    structHash: structHash,
    finalHash: finalHash
  };
}

/**
 * Formats permit object for contract call
 * @param {Object} permit - Permit object
 * @returns {Array} Formatted array for TronWeb contract call
 */
function formatPermitForCall(permit) {
  return [
    [permit.permitted.token, permit.permitted.amount],
    permit.nonce,
    permit.deadline
  ];
}

/**
 * Formats transfer details for contract call
 * @param {Object} transferDetails - Transfer details object
 * @returns {Array} Formatted array for TronWeb contract call
 */
function formatTransferDetailsForCall(transferDetails) {
  return [transferDetails.to, transferDetails.requestedAmount];
}

/**
 * Helper to convert address to hex format
 * @param {string} address - Tron address
 * @param {Object} tronWeb - TronWeb instance
 * @returns {string} Hex formatted address
 */
function toHex(address, tronWeb) {
  return address.startsWith('0x') ? address : tronWeb.address.toHex(address);
}

/**
 * Generates the hash for permitWitnessTransferFrom (ready for signing)
 * @param {Object} tronWeb - TronWeb instance
 * @param {Object} permit - Permit object from createPermit
 * @param {string} witness - Witness hash (bytes32)
 * @param {string} witnessTypeString - Witness type string (e.g., "ExtraData(uint256 value)")
 * @param {string} msgSender - Address that will call permitWitnessTransferFrom
 * @param {string} domainSeparator - Domain separator from the contract
 * @returns {Object} Object containing structHash and finalHash
 */
function getPermitWitnessTransferFromHash(tronWeb, permit, witness, witnessTypeString, msgSender, domainSeparator) {
  // Use hashWithWitness from hash-helpers to create the struct hash
  const structHash = hashHelpers.hashWithWitness(
    tronWeb,
    permit,
    witness,
    witnessTypeString,
    msgSender
  );
  
  // Create final hash using TIP-712
  const finalHash = hashHelpers.hashTypedData(
    tronWeb,
    domainSeparator,
    structHash
  );
  
  return {
    structHash: structHash,
    finalHash: finalHash
  };
}

/**
 * Helper to create witness hash from witness data
 * @param {Object} tronWeb - TronWeb instance
 * @param {*} witnessData - Witness data (can be a value or object)
 * @returns {string} Witness hash (bytes32)
 */
function createWitnessHash(tronWeb, witnessData) {
  if (typeof witnessData === 'string' && witnessData.startsWith('0x')) {
    // Already a hash
    return witnessData;
  }
  
  // For simple single value witness
  if (typeof witnessData === 'number' || typeof witnessData === 'string') {
    const encoded = tronWeb.utils.abi.encodeParams(['uint256'], [witnessData]);
    return tronWeb.utils.ethersUtils.keccak256(encoded);
  }
  
  // For object witness data
  if (typeof witnessData === 'object') {
    const types = Object.keys(witnessData).map(() => 'uint256'); // Simplified - assumes all uint256
    const values = Object.values(witnessData);
    const encoded = tronWeb.utils.abi.encodeParams(types, values);
    return tronWeb.utils.ethersUtils.keccak256(encoded);
  }
  
  throw new Error('Invalid witness data type');
}

module.exports = {
  createPermit,
  createTransferDetails,
  getPermitTransferFromHash,
  getPermitWitnessTransferFromHash,
  createWitnessHash,
  formatPermitForCall,
  formatTransferDetailsForCall,
  toHex
};
