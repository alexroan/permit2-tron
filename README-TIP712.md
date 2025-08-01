# TIP-712 Implementation Details

This document provides technical details on how Permit2 has been adapted for Tron's TIP-712 standard.

## What is TIP-712?

TIP-712 is Tron's adaptation of Ethereum's EIP-712 typed structured data hashing and signing standard. It provides a secure way to sign structured data that is both human-readable and machine-verifiable.

## Key Differences from EIP-712

### 1. ChainId Masking
```solidity
// EIP-712 (Ethereum)
uint256 chainId = block.chainid;

// TIP-712 (Tron)
uint256 chainId = block.chainid & 0xffffffff;
```

The chainId is masked to 32 bits to ensure compatibility across Tron networks.

### 2. Address Encoding
```solidity
// EIP-712 (Ethereum)
keccak256(abi.encode(typeHash, nameHash, chainId, address(this)));

// TIP-712 (Tron)
keccak256(abi.encode(typeHash, nameHash, chainId, uint160(address(this))));
```

All addresses must be cast to `uint160` when encoding for hashing.

## Contract Modifications

### TIP712.sol
- Replaces EIP712.sol as the base contract
- Implements chainId masking in constructor and domain separator
- Casts addresses to uint160 in domain separator calculation

### PermitHash.sol
Modified all hash functions to cast addresses:
- `_hashPermitDetails`: Casts `details.token` to uint160
- `_hashTokenPermissions`: Casts `permitted.token` to uint160
- All `hash()` functions cast spender addresses to uint160

### SignatureTransfer.sol & AllowanceTransfer.sol
- Import TIP712 instead of EIP712
- No other modifications needed as address casting is handled in PermitHash

## Signature Generation

### Using TronWeb

```javascript
// Ensure chainId is masked
const chainId = await tronWeb.trx.getChainParameters();
const maskedChainId = chainId & 0xffffffff;

// Domain must use masked chainId
const domain = {
  name: 'Permit2',
  chainId: maskedChainId,
  verifyingContract: tronWeb.address.toHex(permit2Address)
};

// Sign using TronWeb's _signTypedData
const signature = await tronWeb.trx._signTypedData(
  domain,
  types,
  message,
  privateKey
);
```

### Manual Signature Generation

If `_signTypedData` is not available:

```javascript
// 1. Hash the type data
const TOKEN_PERMISSIONS_TYPEHASH = tronWeb.sha3(
  'TokenPermissions(address token,uint256 amount)'
);

// 2. Encode with uint160 for addresses
const encoded = tronWeb.utils.abi.encodeParams(
  ['bytes32', 'uint160', 'uint256'],
  [TOKEN_PERMISSIONS_TYPEHASH, '0x' + tokenHex.slice(2), amount]
);

// 3. Generate final hash and sign
const messageHash = tronWeb.sha3(
  '0x1901' + domainSeparator.slice(2) + permitHash.slice(2)
);
```

## Testing Considerations

1. **ChainId Discovery**: Local test networks may have different chainIds
2. **Address Format**: Always use hex addresses with TronWeb
3. **Signature Validation**: The spender in the signature must match msg.sender

## Common Integration Patterns

### Frontend Integration
```javascript
// Convert Tron addresses to hex
const ownerHex = TronWeb.address.toHex(ownerAddress);
const spenderHex = TronWeb.address.toHex(spenderAddress);

// Generate permit
const permit = {
  permitted: {
    token: TronWeb.address.toHex(tokenAddress),
    amount: amount.toString()
  },
  spender: spenderHex,
  nonce: nonce,
  deadline: deadline
};
```

### Smart Contract Integration
Contracts calling Permit2 don't need modifications - TIP-712 changes are internal to Permit2.

## Troubleshooting

### Common Issues

1. **Invalid Signature**: Ensure addresses are hex-encoded and chainId is masked
2. **Wrong Spender**: The signature's spender must be the actual function caller
3. **ChainId Mismatch**: Verify the chainId matches the network you're on

### Debugging Tips

- Log the domain separator from the contract and compare with client-side calculation
- Verify all addresses are properly hex-encoded
- Check that the signing account matches the owner parameter

## References

- [TIP-712 Proposal](https://github.com/tronprotocol/tips/blob/master/tip-712.md)
- [EIP-712 Original Specification](https://eips.ethereum.org/EIPS/eip-712)
- [TronWeb Documentation](https://tronweb.network/docu/docs/intro/) 