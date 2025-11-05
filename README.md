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
- Requires Solidity 0.8.23
- Uses viaIR optimization like the original

## Architecture

Permit2 combines two main contracts:

### SignatureTransfer
Handles all signature-based transfers where permissions only last for the duration of the transaction.

### AllowanceTransfer  
Manages persistent allowances with amounts and expiration times.

## Prerequisites

- Node.js v20 (use `nvm use 20` or check `.nvmrc`)
- pnpm v10.12.1  
- Docker (for local TRON node)
- Foundry (for Foundry tests)

## Installation

```bash
# Install dependencies
make install-tronbox  # Installs npm dependencies
make install-foundry  # Installs Foundry dependencies
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

This project supports compilation with both Tronbox and Foundry:

### Tronbox Compilation
```bash
make build-tronbox
# or directly:
pnpm run compile
```

### Foundry Compilation
```bash
make build-foundry
# or directly:
forge build --sizes
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

This project includes comprehensive test suites for both Tronbox (TVM) and Foundry:

### Tronbox Tests (TVM)

Run the full TVM test suite with local TRON node:
```bash
make test-tronbox
```

This command will:
1. Start a local TRON node
2. Deploy contracts  
3. Run tests
4. Stop the node

For individual steps:
```bash
make tron-node-up        # Start local TRON node
make migrate-tronbox     # Deploy contracts
pnpm run test:tronbox    # Run tests only
make tron-node-down      # Stop node
```

The Tronbox tests demonstrate:
- Basic permitTransferFrom functionality with TIP-712 signatures
- Signature validation and spender authorization
- Error cases (expired deadlines, wrong spenders)
- Transfer to different recipients

### Foundry Tests

Run the Foundry test suite:
```bash
make test-foundry
```

Or manually:
```bash
forge test -vvv
```

The Foundry tests provide:
- Comprehensive unit tests for all contract functionality
- Fuzz testing with 10,000 runs per test
- Gas optimization snapshots
- Invariant testing for critical properties

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
| Nile Testnet | `TVvdqUmWbRBwTq5WrUBMoZepELspTt6iR6` | 🧪 Prerelease |
| Shasta Testnet | `TPUqJPASUn1zLvbLBgRZ5pBYrx7WSe5ahp` | 🧪 Prerelease |

**Important Notes:**
- Do NOT use for production applications or real value transfers
- Contract may be redeployed with breaking changes

### Mainnet Deployment

| Network | Address | Status |
|---------|---------|--------|
| Mainnet | `TJhMXTHQHeQyMD7TcKQFqAePNgG4b31H9m` | ✅ Released |

**Verification**: The contract bytecode can be verified using the provided verification script (see Contract Verification section below).

## Contract Verification

### Why Tronscan Verification Isn't Available

This contract uses advanced Solidity compiler settings that Tronscan's web-based verification tool does not support:

- **Via IR Compilation** (`viaIR: true`): Uses Solidity's Intermediate Representation pipeline, which produces different bytecode than the legacy compilation pipeline
- **Custom Bytecode Metadata** (`bytecodeHash: 'none'`): Removes metadata hash from bytecode
- **High Optimization Runs** (1,000,000): Extremely high optimization setting

Tronscan's verification interface only supports standard compilation settings and does not provide options for these advanced flags. Therefore, we provide an independent verification tool that you can run yourself.

### Verifying the Contract

You can verify that the source code in this repository matches the deployed contract on Tron Mainnet using the provided verification script.

#### Quick Verification

```bash
# Using pnpm
pnpm run verify

# Using make
make verify
```

#### What the Script Does

The verification script (`scripts/verify-contract.js`) performs the following steps:

1. **Cleans build artifacts** - Removes any existing compiled contracts
2. **Compiles the contract** - Uses TronBox with the exact same settings as deployment:
   - Solidity 0.8.23
   - Optimizer enabled: 1,000,000 runs
   - Via IR: true
   - Bytecode hash: none
3. **Fetches on-chain bytecode** - Retrieves the deployment bytecode from Tron Mainnet for address `TJhMXTHQHeQyMD7TcKQFqAePNgG4b31H9m`
4. **Compares bytecodes** - Performs byte-by-byte comparison of compiled vs on-chain deployment bytecode

#### Prerequisites

- Node.js v20 or higher
- pnpm installed
- Internet connection (to fetch on-chain bytecode)
- Dependencies installed (`pnpm install`)

#### Verification Output

When verification succeeds, you'll see:

```
✅ VERIFICATION SUCCESSFUL
The compiled bytecode matches the on-chain bytecode.
This confirms that the source code in this repository
matches the contract deployed on Tron Mainnet.
```

If verification fails, the script will:
- Report the mismatch
- Show bytecode length differences
- Indicate the first position where bytes differ
- Suggest possible reasons for the failure

#### For Auditors and Advanced Users

The verification script source code is available at `scripts/verify-contract.js` for inspection. You can review the implementation to understand exactly how the verification is performed. The script uses:

- TronWeb library to fetch contract data from Tron Mainnet
- Standard Node.js APIs for file operations and process execution
- Simple string comparison for bytecode matching

This approach provides transparency and allows anyone to independently verify the contract without relying on third-party verification services.

## Security Considerations

- Always verify the spender in signatures matches the actual caller
- Set reasonable deadlines for signatures
- Users should be careful about which contracts they sign permits for
- Revoke allowances when no longer needed

## Gas Optimization

The contracts use viaIR compilation with high optimization runs (1,000,000) for minimal gas usage.

## Development

### Dual Testing Framework

This project uses both Tronbox and Foundry for comprehensive testing:

- **Tronbox**: Used for TVM-specific testing with actual TRON node interaction
- **Foundry**: Provides fast unit tests, fuzz testing, and gas optimization

Both test suites are run automatically in CI on every push and pull request.

### Key Commands

| Command | Description |
|---------|-------------|
| `make test-tronbox` | Run full TVM test suite |
| `make test-foundry` | Run Foundry test suite |
| `make tron-node-up` | Start local TRON node |
| `make tron-node-down` | Stop local TRON node |
| `make build-tronbox` | Compile with Tronbox |
| `make build-foundry` | Compile with Foundry |
| `make install-tronbox` | Install npm dependencies |
| `make install-foundry` | Install Foundry dependencies |
| `make verify` | Verify contract bytecode matches on-chain deployment |

### Project Structure
```
permit2-tron/
├── contracts/         # Solidity contracts
├── migrations/        # Tronbox deployment scripts
├── test/             # Tronbox test files
├── foundry_tests/    # Foundry test files
├── lib/              # Foundry dependencies
├── scripts/          # Utility scripts
├── build/            # Tronbox compiled contracts
├── out/              # Foundry compiled contracts
├── cache/            # Foundry cache
├── Makefile          # Build and test commands
├── foundry.toml      # Foundry configuration
└── tronbox-config.js # TronBox configuration
```

## Resources

- [Original Permit2 Repository](https://github.com/Uniswap/permit2)
- [TIP-712 Specification](https://github.com/tronprotocol/tips/blob/master/tip-712.md)
- [TronBox Documentation](https://tronbox.io)
- [Tron Developer Hub](https://developers.tron.network)

## License

This project maintains the same license as the original Permit2 implementation.
