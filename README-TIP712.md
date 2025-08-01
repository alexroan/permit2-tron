# Permit2 for TRON (TIP-712 Compliant)

This is a TRON-compatible implementation of Permit2, modified to comply with TIP-712 standards.

## Key Modifications for TRON Compatibility

### 1. TIP-712 vs EIP-712
TRON's TIP-712 differs from Ethereum's EIP-712 in several ways:
- **ChainId Masking**: Use `block.chainid & 0xffffffff` 
- **Address Encoding**: Encode addresses as `uint160` in all `abi.encode` calls

### 2. Contract Changes
- Renamed `EIP712.sol` to `TIP712.sol` and all related interfaces
- Applied chainId masking in domain separator calculation
- Modified all address encodings to use `uint160` in `PermitHash.sol`

### 3. Compilation
```bash
pnpm build
```

### 4. Migration
```bash
pnpm migrate
```

### 5. Testing
```bash
pnpm test
```

## Test Coverage
The test file demonstrates:
1. Basic permitTransferFrom functionality with TIP-712 signatures
2. Signature validation and spender authorization
3. Error cases (expired deadline, wrong spender)

## Key Success Factors
1. Contract encodes all addresses as uint160 for TIP-712 compliance
2. Contract uses masked chainId (`block.chainid & 0xffffffff`)
3. Signature spender matches `msg.sender` (the caller)
4. TronWeb's `_signTypedData` handles TIP-712 requirements correctly

## Contract Addresses (Development Network)
These addresses will change with each deployment:
- Permit2: [Check deployment output]
- MockERC20: [Check deployment output] 