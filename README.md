# Permit2 for Tron

Permit2 introduces a low-overhead, next-generation token approval/meta-tx system to make token approvals easier, more secure, and more consistent across applications. This is a Tron-compatible implementation that follows the TIP-712 standard for typed data signing.

## Features

- **Signature Based Approvals**: Any TRC20 token can use permit style approvals, enabling single transaction flows by sending a permit signature along with the transaction data
- **Batched Token Approvals**: Set permissions on different tokens to different spenders with one signature
- **Signature Based Token Transfers**: Transfer tokens directly via signatures, bypassing allowances and preventing hanging approvals
- **Batched Token Transfers**: Transfer different tokens to different recipients with one signature  
- **Safe Arbitrary Data Verification**: Verify extra data through witness hash and witness type following TIP-712 standard
- **Signature Verification for Contracts**: All signature verification supports contract wallets
- **Non-monotonic Replay Protection**: Unordered, non-monotonic nonces for flexible transaction ordering
- **Expiring Approvals**: Time-bound approvals that automatically expire, removing security concerns around hanging approvals
- **Batch Revoke Allowances**: Remove allowances on any number of tokens and spenders in one transaction

## Key Differences from Ethereum Permit2

This implementation has been adapted for Tron's blockchain with the following key modifications:

### TIP-712 Compliance
- Uses masked chainId: `block.chainid & 0xffffffff` 
- Encodes all addresses as `uint160` in structured data hashing
- Compatible with TronWeb's `_signTypedData` method

### Compilation
- Built with TronBox instead of Foundry
- Requires Solidity 0.8.18
- Uses viaIR optimization like the original

## Architecture

Permit2 combines two main contracts:

### SignatureTransfer
Handles all signature-based transfers where permissions only last for the duration of the transaction.

### AllowanceTransfer  
Manages persistent allowances with amounts and expiration times.

## Installation

```bash
npm install tronbox -g
npm install
```

## Setup

1. Copy the sample environment file:
```bash
cp sample-env .env
```

2. Add your private keys to `.env`:
```
export PRIVATE_KEY_MAINNET=your_mainnet_private_key
export PRIVATE_KEY_SHASTA=your_shasta_private_key
export PRIVATE_KEY_NILE=your_nile_private_key
```

## Compilation

```bash
pnpm build
# or
tronbox compile
```

## Deployment

### Local Development
```bash
pnpm migrate
# or
tronbox migrate
```

### Testnet Deployment

**Shasta Testnet**
```bash
source .env && tronbox migrate --network shasta
```

**Nile Testnet**
```bash
source .env && tronbox migrate --network nile
```

### Mainnet Deployment
```bash
source .env && tronbox migrate --network mainnet
```

## Testing

Run the test suite:
```bash
pnpm test
# or
tronbox test
```

The tests demonstrate:
- Basic permitTransferFrom functionality with TIP-712 signatures
- Signature validation and spender authorization
- Error cases (expired deadlines, wrong spenders)
- Transfer to different recipients

## Integration Guide

### For Integrators

Before using Permit2, users must approve the Permit2 contract on the specific token contract:

```javascript
// User approves Permit2 to spend their tokens
await token.approve(permit2Address, amount).send();
```

### Signature Generation

Generate TIP-712 compliant signatures using TronWeb:

```javascript
const domain = {
  name: 'Permit2',
  chainId: chainId & 0xffffffff, // Masked chainId for TIP-712
  verifyingContract: permit2Address
};

const types = {
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ]
};

const message = {
  permitted: {
    token: tokenAddress,
    amount: amount
  },
  spender: spenderAddress, // Must match msg.sender when calling permitTransferFrom
  nonce: nonce,
  deadline: deadline
};

const signature = await tronWeb.trx._signTypedData(
  domain,
  types,
  message,
  privateKey
);
```

### Using Permit2

```javascript
// Execute transfer using signature
await permit2.permitTransferFrom(
  permit,           // Permit data
  transferDetails,  // Transfer details (to, amount)
  owner,           // Token owner
  signature        // TIP-712 signature
).send();
```

## Contract Addresses

### Testnet Deployments

> ⚠️ **WARNING**: These contracts are for testing purposes only and are NOT ready for production use.

| Network | Address | Status |
|---------|---------|--------|
| Nile Testnet | `TGm3CvZSaRvi7iehvZj7utaKLcP6JwpynF` | 🧪 Experimental |

**Important Notes:**
- This is the first testnet deployment of Permit2 on Tron
- The contract is under active development and testing
- Do NOT use for production applications or real value transfers
- Contract may be redeployed with breaking changes

### Mainnet Deployment

No mainnet deployment yet. Thorough testing on testnet is required before mainnet deployment.

## Security Considerations

- Always verify the spender in signatures matches the actual caller
- Set reasonable deadlines for signatures
- Users should be careful about which contracts they sign permits for
- Revoke allowances when no longer needed

## Gas Optimization

The contracts use viaIR compilation with high optimization runs (1,000,000) for minimal gas usage.

## Development

### Requirements
- Node.js >= 20
- TronBox 
- pnpm (recommended) or npm

### Project Structure
```
permit2-tron-tronbox/
├── contracts/         # Solidity contracts
├── migrations/        # Deployment scripts
├── test/             # Test files
├── build/            # Compiled contracts
└── tronbox-config.js # TronBox configuration
```

## Resources

- [Original Permit2 Repository](https://github.com/Uniswap/permit2)
- [TIP-712 Specification](https://github.com/tronprotocol/tips/blob/master/tip-712.md)
- [TronBox Documentation](https://tronbox.io)
- [Tron Developer Hub](https://developers.tron.network)

## License

This project maintains the same license as the original Permit2 implementation.
