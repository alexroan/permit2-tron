# Deployment Guide

This guide covers deploying Permit2 to various Tron networks.

## Prerequisites

1. **Node.js** version 20 or higher
2. **TronBox** installed globally:
   ```bash
   npm install -g tronbox
   ```
3. **Private keys** for deployment accounts
4. **TRX balance** for deployment gas fees

## Deployment Steps

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 2. Configure Environment

Create a `.env` file from the sample:
```bash
cp sample-env .env
```

Edit `.env` with your private keys:
```
export PRIVATE_KEY_MAINNET=your_mainnet_private_key_here
export PRIVATE_KEY_SHASTA=your_shasta_private_key_here  
export PRIVATE_KEY_NILE=your_nile_private_key_here
```

**Security Note**: Never commit `.env` files to version control.

### 3. Compile Contracts

```bash
tronbox compile
```

This generates artifacts in the `build/contracts/` directory.

### 4. Deploy to Networks

#### Local Development Network

For local testing with TronBox Runtime Environment:

```bash
# Start local network (in separate terminal)
docker run -p 9090:9090 tronbox/tre

# Deploy
tronbox migrate
```

#### Shasta Testnet

1. Get test TRX from: https://shasta.tronex.io/
2. Deploy:
   ```bash
   source .env && tronbox migrate --network shasta
   ```

#### Nile Testnet

1. Get test TRX from: https://nileex.io/join/getJoinPage
2. Deploy:
   ```bash
   source .env && tronbox migrate --network nile
   ```

#### Mainnet

**Warning**: Thoroughly test on testnets before mainnet deployment.

```bash
source .env && tronbox migrate --network mainnet
```

## Deployment Output

After successful deployment, you'll see:

```
Deploying 'Permit2'
-------------------
> transaction hash:    0x...
> contract address:    T...
> block number:        12345678
> block timestamp:     1234567890
> account:             T...
> energy used:         1234567
> energy price:        280 sun
```

Save the contract address for integration.

## Verifying Deployment

### 1. Check Contract on Explorer

- **Mainnet**: https://tronscan.org/#/contract/{address}
- **Shasta**: https://shasta.tronscan.org/#/contract/{address}
- **Nile**: https://nile.tronscan.org/#/contract/{address}

### 2. Verify Basic Functionality

```javascript
const TronWeb = require('tronweb');
const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io', // or testnet URL
  privateKey: 'your_private_key'
});

// Load contract
const permit2 = await tronWeb.contract().at('YOUR_PERMIT2_ADDRESS');

// Check domain separator
const domainSeparator = await permit2.DOMAIN_SEPARATOR().call();
console.log('Domain Separator:', domainSeparator);
```

## Network Configuration

Current network settings in `tronbox-config.js`:

| Network | RPC URL | Chain ID | Fee Limit |
|---------|---------|----------|-----------|
| Development | http://127.0.0.1:9090 | Varies | 1000 TRX |
| Shasta | https://api.shasta.trongrid.io | 2494104990 | 1000 TRX |
| Nile | https://nile.trongrid.io | 3448148188 | 1000 TRX |
| Mainnet | https://api.trongrid.io | 728126428 | 1000 TRX |

## Post-Deployment

### 1. Update Frontend Configuration

Add the deployed address to your dApp:

```javascript
const PERMIT2_ADDRESSES = {
  mainnet: 'T...',
  shasta: 'T...',
  nile: 'T...'
};
```

### 2. Set Up Monitoring

Monitor contract events and transactions through:
- TronGrid Event API
- Custom event indexing
- Block explorer APIs

### 3. Emergency Procedures

Permit2 is immutable once deployed. Ensure you:
- Test thoroughly on testnets
- Have incident response procedures
- Monitor for unusual activity

## Common Issues

### Insufficient Energy

Error: `REVERT opcode executed`

Solution: Ensure account has enough TRX for energy

### Invalid Private Key

Error: `Invalid private key provided`

Solution: Check private key format (64 hex characters, no 0x prefix)

### Network Connection

Error: `CONNECTION ERROR`

Solution: Verify network URL and internet connection

## Gas Costs

Approximate deployment costs:
- **Energy**: ~5-10 million
- **TRX Cost**: ~1400-2800 TRX (at 280 sun per energy)

Costs vary based on network congestion.

## Best Practices

1. **Test First**: Always deploy to testnet first
2. **Backup Keys**: Securely store deployment keys
3. **Document Addresses**: Record all deployed addresses
4. **Monitor Events**: Set up event monitoring post-deployment
5. **Verify Source**: Consider source code verification on TronScan 