# Permit2 API Reference

This document provides a detailed API reference for the Permit2 contracts on Tron.

## Core Contracts

### Permit2

The main entry point that inherits from both `SignatureTransfer` and `AllowanceTransfer`.

```solidity
contract Permit2 is SignatureTransfer, AllowanceTransfer
```

### SignatureTransfer

Handles one-time signature-based transfers.

#### Functions

##### permitTransferFrom

```solidity
function permitTransferFrom(
    PermitTransferFrom memory permit,
    SignatureTransferDetails calldata transferDetails,
    address owner,
    bytes calldata signature
) external
```

Transfers tokens using a signed permit message.

**Parameters:**
- `permit`: The permit data signed by the owner
- `transferDetails`: Transfer recipient and amount
- `owner`: The owner of the tokens being transferred
- `signature`: TIP-712 signature

##### permitWitnessTransferFrom

```solidity
function permitWitnessTransferFrom(
    PermitTransferFrom memory permit,
    SignatureTransferDetails calldata transferDetails,
    address owner,
    bytes32 witness,
    string calldata witnessTypeString,
    bytes calldata signature
) external
```

Transfers tokens using a signed permit with additional witness data.

##### permitTransferFromBatch

```solidity
function permitTransferFromBatch(
    PermitBatchTransferFrom memory permit,
    SignatureTransferDetails[] calldata transferDetails,
    address owner,
    bytes calldata signature
) external
```

Transfers multiple tokens to potentially different recipients.

##### invalidateNonces

```solidity
function invalidateNonces(address token, address spender, uint48 newNonce) external
```

Invalidates nonces for a given token, spender, and nonce.

#### Structs

##### PermitTransferFrom

```solidity
struct PermitTransferFrom {
    TokenPermissions permitted;
    uint256 nonce;
    uint256 deadline;
}
```

##### TokenPermissions

```solidity
struct TokenPermissions {
    address token;
    uint256 amount;
}
```

##### SignatureTransferDetails

```solidity
struct SignatureTransferDetails {
    address to;
    uint256 requestedAmount;
}
```

### AllowanceTransfer

Manages allowances with expiration times.

#### Functions

##### approve

```solidity
function approve(
    address token,
    address spender,
    uint160 amount,
    uint48 expiration
) external
```

Approves an allowance for a spender.

**Parameters:**
- `token`: The token to approve
- `spender`: The spender to approve
- `amount`: The amount to approve (uint160)
- `expiration`: Timestamp when approval expires (uint48)

##### permit

```solidity
function permit(
    address owner,
    PermitSingle memory permitSingle,
    bytes calldata signature
) external
```

Sets allowance using a signed permit message.

##### permitBatch

```solidity
function permitBatch(
    address owner,
    PermitBatch memory permitBatch,
    bytes calldata signature
) external
```

Sets multiple allowances with one signature.

##### transferFrom

```solidity
function transferFrom(
    address from,
    address to,
    uint160 amount,
    address token
) external
```

Transfers tokens from an owner who has set an allowance.

##### invalidateNonces

```solidity
function invalidateNonces(uint256 newNonce) external
```

Invalidate nonces for the msg.sender.

#### Structs

##### PermitSingle

```solidity
struct PermitSingle {
    PermitDetails details;
    address spender;
    uint256 sigDeadline;
}
```

##### PermitDetails

```solidity
struct PermitDetails {
    address token;
    uint160 amount;
    uint48 expiration;
    uint48 nonce;
}
```

##### AllowanceTransferDetails

```solidity
struct AllowanceTransferDetails {
    address from;
    address to;
    uint160 amount;
    address token;
}
```

## Events

### SignatureTransfer Events

```solidity
event NonceInvalidation(
    address indexed owner,
    address indexed token,
    address indexed spender,
    uint48 newNonce,
    uint48 oldNonce
);
```

### AllowanceTransfer Events

```solidity
event Approval(
    address indexed owner,
    address indexed token,
    address indexed spender,
    uint160 amount,
    uint48 expiration
);

event Permit(
    address indexed owner,
    address indexed token,
    address indexed spender,
    uint160 amount,
    uint48 expiration,
    uint48 nonce
);

event Lockdown(
    address indexed owner,
    address token,
    address spender
);
```

## Error Types

```solidity
error InvalidSigner();
error SignatureExpired(uint256 deadline);
error InvalidNonce();
error InsufficientAllowance(uint256 amount);
error AllowanceExpired(uint256 deadline);
error LengthMismatch();
```

## Integration Examples

### Basic Transfer

```javascript
// 1. Owner signs permit
const permit = {
  permitted: {
    token: tokenAddress,
    amount: amount
  },
  nonce: nonce,
  deadline: deadline
};

// 2. Anyone can execute transfer
await permit2.permitTransferFrom(
  permit,
  { to: recipient, requestedAmount: amount },
  owner,
  signature
);
```

### Allowance Pattern

```javascript
// 1. Owner sets allowance via signature
await permit2.permit(
  owner,
  {
    details: {
      token: tokenAddress,
      amount: amount,
      expiration: expiration,
      nonce: nonce
    },
    spender: spender,
    sigDeadline: deadline
  },
  signature
);

// 2. Spender transfers anytime before expiration
await permit2.transferFrom(
  owner,
  recipient,
  amount,
  tokenAddress
);
```

## Gas Considerations

- Single transfers are more gas efficient than batch operations for 1-2 tokens
- Witness data adds ~20k gas overhead
- Allowance transfers are cheaper than signature transfers for repeated operations

## Security Notes

1. Always validate signatures match the caller (spender)
2. Set reasonable deadlines to prevent replay attacks
3. Monitor nonce invalidation events
4. Check allowance expiration before relying on approvals 