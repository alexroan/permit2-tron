# TIP-712 Changes for Permit2 on TronVM

This document summarizes all the changes made to the Permit2 codebase to support TIP-712 (TRON's implementation of EIP-712).

## Overview

TIP-712 requires two main modifications from standard EIP-712:
1. **ChainId**: Use only the higher 4 bytes (`block.chainid & 0xffffffff`)
2. **Address Encoding**: Encode addresses as `uint160` (removing the TRON-specific 0x41 prefix)

## Important Note

The Solidity pragma versions remain unchanged at `0.8.17` (or `^0.8.17` for libraries). Only the TIP-712 specific changes have been applied.

## Changes Made

### 1. EIP712.sol

**File**: `src/EIP712.sol`

#### Changes:
- **Constructor**: Mask chainId when caching
  ```solidity
  // TIP-712: Use masked chainId
  _CACHED_CHAIN_ID = block.chainid & 0xffffffff;
  ```

- **DOMAIN_SEPARATOR()**: Compare masked chainIds
  ```solidity
  // TIP-712: Compare masked chainIds
  return (block.chainid & 0xffffffff) == _CACHED_CHAIN_ID
      ? _CACHED_DOMAIN_SEPARATOR
      : _buildDomainSeparator(_TYPE_HASH, _HASHED_NAME);
  ```

- **_buildDomainSeparator()**: Use masked chainId and encode address as uint160
  ```solidity
  // TIP-712: Use masked chainId and encode address as uint160
  uint256 chainId = block.chainid & 0xffffffff;
  return keccak256(
      abi.encode(typeHash, nameHash, chainId, uint160(address(this)))
  );
  ```

### 2. PermitHash.sol

**File**: `src/libraries/PermitHash.sol`

#### Changes:
All address parameters in hash functions are now encoded as `uint160`:

- **hash(PermitSingle)**: 
  ```solidity
  uint160(permitSingle.spender)
  ```

- **hash(PermitBatch)**:
  ```solidity
  uint160(permitBatch.spender)
  ```

- **hash(PermitTransferFrom)**:
  ```solidity
  uint160(msg.sender)
  ```

- **hash(PermitBatchTransferFrom)**:
  ```solidity
  uint160(msg.sender)
  ```

- **hashWithWitness() functions**:
  ```solidity
  uint160(msg.sender)
  ```

- **_hashPermitDetails()**:
  ```solidity
  // TIP-712: encode address as uint160
  return keccak256(abi.encode(
      _PERMIT_DETAILS_TYPEHASH, 
      uint160(details.token), 
      details.amount, 
      details.expiration, 
      details.nonce
  ));
  ```

- **_hashTokenPermissions()**:
  ```solidity
  // TIP-712: encode address as uint160
  return keccak256(abi.encode(
      _TOKEN_PERMISSIONS_TYPEHASH, 
      uint160(permitted.token), 
      permitted.amount
  ));
  ```

## Key Points for JavaScript/TronWeb Integration

1. **Use `_signTypedData`**: TronWeb's `_signTypedData` function automatically handles TIP-712 requirements
2. **ChainId**: For local testnet, use the actual masked chainId (e.g., `3360022319`)
3. **Spender Field**: The spender in the signature MUST be the account that calls `permitTransferFrom` (i.e., `msg.sender`)

## Testing

The changes have been tested with TronWeb and verified to work correctly with TIP-712 signatures. See the test file in the main project for examples of how to generate compatible signatures.

## Files Modified

1. `src/EIP712.sol` - Domain separator logic with masked chainId and uint160 address encoding
2. `src/libraries/PermitHash.sol` - All hash functions updated to encode addresses as uint160

No other files were modified. The changes are minimal and focused solely on TIP-712 compliance. 