/**
 * Hash Helper Functions for Permit2 on Tron
 * 
 * These helper functions mimic the on-chain library functions and have been
 * verified to produce the same output as the Solidity implementations.
 */

const hashHelpers = {
  /**
   * Mimics PermitHash._hashTokenPermissions
   * @param {Object} tronWeb - TronWeb instance
   * @param {string} token - Token address
   * @param {string} amount - Amount to permit
   * @param {string} typeHash - Optional custom type hash
   * @returns {string} Keccak256 hash of the token permissions
   */
  hashTokenPermissions: (tronWeb, token, amount, typeHash = null) => {
    // TOKEN_PERMISSIONS_TYPEHASH = keccak256("TokenPermissions(address token,uint256 amount)")
    const TOKEN_PERMISSIONS_TYPEHASH = typeHash || ('0x' + tronWeb.sha3('TokenPermissions(address token,uint256 amount)', false));
    
    // Convert token address to hex if needed
    const tokenHex = token.startsWith('0x') ? token : tronWeb.address.toHex(token);
    
    // Convert address to uint160 by removing the 41 prefix and converting to BigInt
    const tokenWithout41 = '0x' + tokenHex.slice(2);
    const tokenBigInt = BigInt(tokenWithout41).toString();
    
    // Encode: typehash, token as uint160, amount
    const encoded = tronWeb.utils.abi.encodeParams(
      ['bytes32', 'uint160', 'uint256'],
      [TOKEN_PERMISSIONS_TYPEHASH, tokenBigInt, amount]
    );
    
    // Return keccak256 hash using ethersUtils (TronWeb.sha3 has issues with 0x prefix)
    return tronWeb.utils.ethersUtils.keccak256(encoded);
  },
  
  /**
   * Mimics PermitHash.hashWithWitness
   * @param {Object} tronWeb - TronWeb instance
   * @param {Object} permit - Permit object with permitted, spender, nonce, deadline
   * @param {string} witness - Witness hash (bytes32)
   * @param {string} witnessTypeString - Witness type string (e.g., "ExtraData(uint256 value)")
   * @param {string} msgSender - Address of the account that will call the function
   * @returns {string} Keccak256 hash of the permit with witness
   */
  hashWithWitness: (tronWeb, permit, witness, witnessTypeString, msgSender) => {
    // Calculate the permit type hash
    const PERMIT_TRANSFER_FROM_WITNESS_TYPEHASH_STUB = 
      "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,";
    const typeHash = tronWeb.utils.ethersUtils.keccak256(
      tronWeb.utils.ethersUtils.toUtf8Bytes(PERMIT_TRANSFER_FROM_WITNESS_TYPEHASH_STUB + witnessTypeString)
    );
    
    // Calculate token permissions hash
    const tokenPermissionsHash = hashHelpers.hashTokenPermissions(
      tronWeb,
      permit.permitted.token,
      permit.permitted.amount
    );
    
    // Convert msg.sender to uint160
    const msgSenderHex = msgSender.startsWith('0x') ? msgSender : tronWeb.address.toHex(msgSender);
    const msgSenderWithout41 = '0x' + msgSenderHex.slice(2);
    const msgSenderBigInt = BigInt(msgSenderWithout41).toString();
    
    // Encode the permit data
    const encoded = tronWeb.utils.abi.encodeParams(
      ['bytes32', 'bytes32', 'uint160', 'uint256', 'uint256', 'bytes32'],
      [typeHash, tokenPermissionsHash, msgSenderBigInt, permit.nonce, permit.deadline, witness]
    );
    
    // Return keccak256 hash
    return tronWeb.utils.ethersUtils.keccak256(encoded);
  },
  
  /**
   * Mimics TIP712._hashTypedData
   * @param {Object} tronWeb - TronWeb instance
   * @param {string} domainSeparator - Domain separator hash
   * @param {string} structHash - Struct hash
   * @returns {string} Final hash ready for signing
   */
  hashTypedData: (tronWeb, domainSeparator, structHash) => {
    // Encode according to EIP-712/TIP-712 standard
    // "\x19\x01" + domainSeparator + structHash
    const encoded = '0x1901' + domainSeparator.slice(2) + structHash.slice(2);
    
    // Return keccak256 hash
    return tronWeb.utils.ethersUtils.keccak256(encoded);
  },
  
  /**
   * Mimics SignatureVerification.verify
   * @param {Object} tronWeb - TronWeb instance
   * @param {string} signature - Signature to verify
   * @param {string} hash - Hash that was signed
   * @param {string} claimedSigner - Address claiming to have signed
   * @returns {boolean} True if signature is valid
   * @throws {Error} If signature is invalid
   */
  verify: (tronWeb, signature, hash, claimedSigner) => {
    // Handle both 65-byte and 64-byte (EIP-2098) signatures
    let r, s, v;
    
    if (signature.length === 132) { // 65 bytes * 2 + 0x prefix
      // Standard 65-byte signature
      r = '0x' + signature.slice(2, 66);
      s = '0x' + signature.slice(66, 130);
      v = parseInt(signature.slice(130, 132), 16);
    } else if (signature.length === 130) { // 64 bytes * 2 + 0x prefix
      // EIP-2098 compact signature
      r = '0x' + signature.slice(2, 66);
      const vs = '0x' + signature.slice(66, 130);
      // Extract s by masking the highest bit
      const vsBigInt = BigInt(vs);
      const UPPER_BIT_MASK = BigInt('0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      s = '0x' + (vsBigInt & UPPER_BIT_MASK).toString(16).padStart(64, '0');
      // Extract v from the highest bit
      v = Number(vsBigInt >> BigInt(255)) + 27;
    } else {
      throw new Error('InvalidSignatureLength');
    }
    
    // Recover the signer using ethersUtils
    const recoveredAddress = tronWeb.utils.ethersUtils.recoverAddress(hash, { r, s, v });
    
    if (!recoveredAddress) {
      throw new Error('InvalidSignature');
    }
    
    // Convert both addresses to hex for comparison
    // ethersUtils returns Ethereum-style address (0x prefix, no 41), so we need to convert
    const recoveredHex = '41' + recoveredAddress.slice(2).toLowerCase();
    const claimedHex = tronWeb.address.toHex(claimedSigner).toLowerCase();
    
    if (recoveredHex.toLowerCase() !== claimedHex.toLowerCase()) {
      throw new Error(`InvalidSigner: claimed ${claimedHex}, recovered ${recoveredHex}`);
    }
    
    return true;
  }
};

module.exports = hashHelpers;
