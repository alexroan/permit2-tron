const testHelpers = require('./test-helpers');

contract('Permit2 - TIP-712 Compliant', () => {
  let permit2, permit2_2;
  let mockERC20;
  let owner, secondAccount;
  let ownerPrivateKey;
  const TOKEN_AMOUNT = '100000000000000000000'; // 100 tokens
  const TRANSFER_AMOUNT = '10000000000000000000'; // 10 tokens

  before(async () => {
    await testHelpers.setupAccounts();
    
    owner = testHelpers.accounts.owner.address;
    secondAccount = testHelpers.accounts.second.address;
    ownerPrivateKey = testHelpers.accounts.owner.privateKey;
    
    console.log('=== Test Accounts ===');
    console.log('Owner:', owner);
    console.log('Second:', secondAccount);
  });

  it('should successfully execute permitTransferFrom with TIP-712 signature', async () => {
    // Load contract artifacts
    const Permit2 = artifacts.require('Permit2');
    const MockERC20 = artifacts.require('MockERC20');
    
    // Deploy contracts using TronWeb
    const permit2Json = Permit2._json;
    const mockERC20Json = MockERC20._json;
    
    permit2 = await testHelpers.deployContract(testHelpers.ownerWeb(), permit2Json);
    mockERC20 = await testHelpers.deployContract(testHelpers.ownerWeb(), mockERC20Json, "Mock Token", "MOCK");
    
    // Get second account instance of Permit2 (this will be the caller)
    permit2_2 = await testHelpers.getContractAt(testHelpers.secondWeb(), permit2Json, permit2.address);
    
    console.log('\n=== Contract Addresses ===');
    console.log('Permit2:', permit2.address);
    console.log('MockERC20:', mockERC20.address);
    
    // Setup: Mint and approve
    await mockERC20.mint(owner, TOKEN_AMOUNT).send();
    await mockERC20.approve(permit2.address, TOKEN_AMOUNT).send();
    
    const allowance = await mockERC20.allowance(owner, permit2.address).call();
    console.log('Permit2 allowance:', allowance.toString());
    
    // Get domain separator and chainId from contract
    const domainSeparator = await permit2.DOMAIN_SEPARATOR().call();
    console.log('\n=== Contract Info ===');
    console.log('Domain Separator:', domainSeparator);
    
    // Prepare permit data
    const nonce = Math.floor(Math.random() * 10000);
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    
    const TronWeb = testHelpers.ownerWeb().constructor;
    
    // Convert addresses to hex
    const tokenHex = TronWeb.address.toHex(mockERC20.address);
    const ownerHex = TronWeb.address.toHex(owner);
    const secondAccountHex = TronWeb.address.toHex(secondAccount);
    const permit2Hex = TronWeb.address.toHex(permit2.address);
    
    console.log('\n=== Permit Details ===');
    console.log('Token (hex):', tokenHex);
    console.log('Owner (hex):', ownerHex);
    console.log('Spender/Caller (hex):', secondAccountHex);
    console.log('Amount:', TRANSFER_AMOUNT);
    console.log('Nonce:', nonce);
    console.log('Deadline:', deadline);
    
    // Generate signature
    let signature;
    
    if (testHelpers.ownerWeb().trx._signTypedData) {
      console.log('\n=== Generating TIP-712 Signature ===');
      
      // Use the chainId we discovered for local testnet
      const chainId = 3360022319;
      
      const domain = {
        name: 'Permit2',
        chainId: chainId,
        verifyingContract: permit2Hex
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
      
      // CRITICAL: The spender MUST be the account that will call permitTransferFrom
      // In Permit2, this is enforced by using msg.sender in the hash
      const message = {
        permitted: {
          token: tokenHex,
          amount: TRANSFER_AMOUNT
        },
        spender: secondAccountHex, // The second account will call permitTransferFrom
        nonce: nonce,
        deadline: deadline
      };
      
      console.log('Domain:', JSON.stringify(domain, null, 2));
      console.log('Message:', JSON.stringify(message, null, 2));
      
      signature = await testHelpers.ownerWeb().trx._signTypedData(
        domain,
        types,
        message,
        ownerPrivateKey
      );
      
      console.log('Signature generated:', signature);
    } else {
      // Fallback to manual signing
      console.log('\n=== Manual TIP-712 Signature Generation ===');
      
      const TOKEN_PERMISSIONS_TYPEHASH = '0x' + TronWeb.sha3(
        'TokenPermissions(address token,uint256 amount)', false
      );
      const PERMIT_TRANSFER_FROM_TYPEHASH = '0x' + TronWeb.sha3(
        'PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)', false
      );
      
      // For TIP-712, addresses need to be encoded as uint160
      // TronWeb's encodeParams should handle this when we specify uint160 type
      const tokenPermissionsEncoded = testHelpers.ownerWeb().utils.abi.encodeParams(
        ['bytes32', 'uint160', 'uint256'],
        [TOKEN_PERMISSIONS_TYPEHASH, '0x' + tokenHex.slice(2), TRANSFER_AMOUNT]
      );
      const tokenPermissionsHash = '0x' + TronWeb.sha3(tokenPermissionsEncoded, false);
      
      const permitEncoded = testHelpers.ownerWeb().utils.abi.encodeParams(
        ['bytes32', 'bytes32', 'uint160', 'uint256', 'uint256'],
        [PERMIT_TRANSFER_FROM_TYPEHASH, tokenPermissionsHash, '0x' + secondAccountHex.slice(2), nonce, deadline]
      );
      const permitHash = '0x' + TronWeb.sha3(permitEncoded, false);
      
      const messageHash = '0x' + TronWeb.sha3(
        '0x1901' + domainSeparator.slice(2) + permitHash.slice(2), false
      );
      
      signature = await testHelpers.ownerWeb().trx.sign(
        messageHash.slice(2),
        ownerPrivateKey,
        false
      );
    }
    
    // Record balances before
    const ownerBalanceBefore = await mockERC20.balanceOf(owner).call();
    const secondBalanceBefore = await mockERC20.balanceOf(secondAccount).call();
    
    console.log('\n=== Balances Before ===');
    console.log('Owner:', ownerBalanceBefore.toString());
    console.log('Second:', secondBalanceBefore.toString());
    
    // Execute permitTransferFrom from second account
    console.log('\n=== Executing permitTransferFrom ===');
    console.log('Caller: Second Account');
    console.log('Transferring from Owner to Second Account');
    
    try {
      const result = await permit2_2.permitTransferFrom(
        [
          [mockERC20.address, TRANSFER_AMOUNT],
          nonce,
          deadline
        ],
        [secondAccount, TRANSFER_AMOUNT], // Transfer to the second account
        ownerHex, // From the owner
        signature
      ).send({
        shouldPollResponse: true
      });
      
      console.log('✅ Transaction successful!');
      console.log('Transaction ID:', result);
      
      // Get transaction info to check events
      const txInfo = await testHelpers.ownerWeb().trx.getTransactionInfo(result);
      if (txInfo.log && txInfo.log.length > 0) {
        console.log('\nEvents emitted:', txInfo.log.length);
      }
      
      // Verify balances changed
      const ownerBalanceAfter = await mockERC20.balanceOf(owner).call();
      const secondBalanceAfter = await mockERC20.balanceOf(secondAccount).call();
      
      console.log('\n=== Balances After ===');
      console.log('Owner:', ownerBalanceAfter.toString());
      console.log('Second:', secondBalanceAfter.toString());
      
      // Calculate changes
      const ownerChange = BigInt(ownerBalanceAfter) - BigInt(ownerBalanceBefore);
      const secondChange = BigInt(secondBalanceAfter) - BigInt(secondBalanceBefore);
      
      console.log('\n=== Balance Changes ===');
      console.log('Owner:', ownerChange.toString());
      console.log('Second:', '+' + secondChange.toString());
      
      // Assert the transfer worked
      assert.equal(
        ownerBalanceAfter.toString(), 
        (BigInt(ownerBalanceBefore) - BigInt(TRANSFER_AMOUNT)).toString(),
        'Owner balance should decrease by transfer amount'
      );
      assert.equal(
        secondBalanceAfter.toString(), 
        (BigInt(secondBalanceBefore) + BigInt(TRANSFER_AMOUNT)).toString(),
        'Recipient balance should increase by transfer amount'
      );
      
      console.log('\n🎉 SUCCESS: Permit2 is working on TronVM with TIP-712!');
      console.log('\nKey Success Factors:');
      console.log('1. Contract encodes all addresses as uint160');
      console.log('2. Contract uses masked chainId (block.chainid & 0xffffffff)');
      console.log('3. Signature spender matches msg.sender (the caller)');
      console.log('4. TronWeb._signTypedData handles TIP-712 requirements');
      
    } catch (error) {
      console.error('\n❌ Transaction failed!');
      console.error('Error:', error.message);
      
      if (error.output && error.output.contractResult) {
        const errorData = error.output.contractResult[0];
        console.error('Contract result:', errorData);
        
        // Decode known error selectors
        const errorSelectors = {
          '815e1d64': 'InvalidSigner',
          '5c98e02e': 'SignatureExpired',
          '2c5211c6': 'InvalidAmount',
          '756688fe': 'InvalidNonce',
          'd71b45d3': 'InvalidSignerDebug'
        };
        
        if (errorSelectors[errorData]) {
          console.error('Error type:', errorSelectors[errorData]);
        }
      }
      
      throw error;
    }
  });
  
  it('should allow transfer to a different recipient', async () => {
    console.log('\n=== Test: Transfer to Different Recipient ===');
    
    // This test shows that the spender can transfer to any recipient
    const thirdAccount = testHelpers.accounts.third.address;
    const TronWeb = testHelpers.ownerWeb().constructor;
    
    // Prepare new permit
    const nonce = Math.floor(Math.random() * 10000);
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const amount = '5000000000000000000'; // 5 tokens
    
    const chainId = 3360022319;
    
    const domain = {
      name: 'Permit2',
      chainId: chainId,
      verifyingContract: TronWeb.address.toHex(permit2.address)
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
        token: TronWeb.address.toHex(mockERC20.address),
        amount: amount
      },
      spender: TronWeb.address.toHex(secondAccount), // Second account is still the spender
      nonce: nonce,
      deadline: deadline
    };
    
    const signature = await testHelpers.ownerWeb().trx._signTypedData(
      domain,
      types,
      message,
      ownerPrivateKey
    );
    
    // Get balance before
    const thirdBalanceBefore = await mockERC20.balanceOf(thirdAccount).call();
    
    // Execute transfer to third account
    const result = await permit2_2.permitTransferFrom(
      [
        [mockERC20.address, amount],
        nonce,
        deadline
      ],
      [thirdAccount, amount], // Transfer to third account instead
      TronWeb.address.toHex(owner),
      signature
    ).send({
      shouldPollResponse: true
    });
    
    console.log('✅ Transfer to third account successful!');
    
    // Verify balance
    const thirdBalanceAfter = await mockERC20.balanceOf(thirdAccount).call();
    console.log('Third account balance change:', 
      (BigInt(thirdBalanceAfter) - BigInt(thirdBalanceBefore)).toString()
    );
    
    assert.equal(
      thirdBalanceAfter.toString(),
      (BigInt(thirdBalanceBefore) + BigInt(amount)).toString(),
      'Third account should receive tokens'
    );
  });
  
  it('should fail with expired deadline', async () => {
    console.log('\n=== Test: Expired Deadline ===');
    
    const TronWeb = testHelpers.ownerWeb().constructor;
    const nonce = Math.floor(Math.random() * 10000);
    const deadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    
    const chainId = 3360022319;
    
    const domain = {
      name: 'Permit2',
      chainId: chainId,
      verifyingContract: TronWeb.address.toHex(permit2.address)
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
        token: TronWeb.address.toHex(mockERC20.address),
        amount: '1000000000000000000'
      },
      spender: TronWeb.address.toHex(secondAccount),
      nonce: nonce,
      deadline: deadline
    };
    
    const signature = await testHelpers.ownerWeb().trx._signTypedData(
      domain,
      types,
      message,
      ownerPrivateKey
    );
    
    try {
      await permit2_2.permitTransferFrom(
        [
          [mockERC20.address, '1000000000000000000'],
          nonce,
          deadline
        ],
        [secondAccount, '1000000000000000000'],
        TronWeb.address.toHex(owner),
        signature
      ).send({
        shouldPollResponse: true
      });
      
      assert.fail('Expected transaction to revert');
    } catch (error) {
      console.log('✅ Transaction correctly reverted with expired deadline');
      assert(error.message.includes('REVERT'), 'Should revert with expired deadline');
    }
  });
}); 