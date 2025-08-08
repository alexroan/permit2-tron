# Permit2 Helper Functions

This directory contains helper functions for working with Permit2 on Tron.

## Files

### hash-helpers.js
Low-level hash functions that exactly mimic the on-chain Solidity library functions:
- `hashTokenPermissions` - Hashes token permissions according to PermitHash library
- `hashWithWitness` - Hashes permit data with witness data
- `hashTypedData` - Creates final TIP-712 hash
- `verify` - Verifies signatures (supports both standard and EIP-2098 compact signatures)

These functions have been verified to produce identical output to their on-chain counterparts.

### permit-helpers.js
Higher-level helper functions for preparing permit data:
- `createPermit` - Creates a properly formatted permit structure
- `createTransferDetails` - Creates transfer details structure
- `getPermitTransferFromHash` - Generates the hash for permitTransferFrom (ready for signing)
- `getPermitWitnessTransferFromHash` - Generates the hash for permitWitnessTransferFrom (ready for signing)
- `createWitnessHash` - Creates witness hash from witness data (supports numbers, strings, and objects)
- `formatPermitForCall` - Formats permit object for TronWeb contract call
- `formatTransferDetailsForCall` - Formats transfer details for TronWeb contract call
- `toHex` - Converts Tron address to hex format

## Usage Example

```javascript
const permitHelpers = require('./helpers/permit-helpers');
const hashHelpers = require('./helpers/hash-helpers');

// Create permit data
const permit = permitHelpers.createPermit(
  tokenAddress,
  amount,
  spenderAddress,
  nonce,
  deadline
);

const transferDetails = permitHelpers.createTransferDetails(
  recipientAddress,
  amount
);

// Generate hash for signing
const domainSeparator = await permit2.DOMAIN_SEPARATOR().call();
const { finalHash } = permitHelpers.getPermitTransferFromHash(
  tronWeb,
  permit,
  domainSeparator
);

// Sign the hash (using your preferred method)
const signature = await signHash(finalHash);

// Execute the permit
await permit2.permitTransferFrom(
  permitHelpers.formatPermitForCall(permit),
  permitHelpers.formatTransferDetailsForCall(transferDetails),
  ownerAddress,
  signature
);
```

### Witness Example

```javascript
// Create witness data
const witnessValue = 12345;
const witnessTypeString = "ExtraData(uint256 value)";
const witness = permitHelpers.createWitnessHash(tronWeb, witnessValue);

// Generate hash for permitWitnessTransferFrom
const { finalHash } = permitHelpers.getPermitWitnessTransferFromHash(
  tronWeb,
  permit,
  witness,
  witnessTypeString,
  msgSender, // Account that will call permitWitnessTransferFrom
  domainSeparator
);

// Sign and execute
const signature = await signHash(finalHash);
await permit2.permitWitnessTransferFrom(
  permitHelpers.formatPermitForCall(permit),
  permitHelpers.formatTransferDetailsForCall(transferDetails),
  ownerAddress,
  witness,
  witnessTypeString,
  signature
);
```

## Key Differences from EVM

1. **Address Encoding**: Tron addresses are encoded as `uint160` in TIP-712, requiring removal of the '41' prefix
2. **Chain ID**: Uses masked chain ID (`chainId & 0xffffffff`) for TIP-712
3. **Hashing**: Use `tronWeb.utils.ethersUtils.keccak256()` for consistent results

## Testing

All helper functions are tested against the on-chain implementations to ensure correctness.
