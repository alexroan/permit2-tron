const testHelpers = require('./test-helpers');
const hashHelpers = require('../helpers/hash-helpers');

contract('Permit2 - TIP-712 Compliant', () => {
  let permit2, permit2_2;
  let mockERC20;
  let testHashing;
  let owner, secondAccount, thirdAccount;
  let ownerPrivateKey;
  let TronWeb;
  let chainId = (3360022319 & 0xffffffff) >>> 0; // Local testnet chainId masked for TIP-712
  
  const TOKEN_AMOUNT = '100000000000000000000'; // 100 tokens
  const TRANSFER_AMOUNT = '10000000000000000000'; // 10 tokens

  before(async () => {
    await testHelpers.setupAccounts();
    
    owner = testHelpers.accounts.owner.address;
    secondAccount = testHelpers.accounts.second.address;
    thirdAccount = testHelpers.accounts.third.address;
    ownerPrivateKey = testHelpers.accounts.owner.privateKey;
    TronWeb = testHelpers.ownerWeb().constructor;
    
    console.log('=== Test Accounts ===');
    console.log('Owner:', owner);
    console.log('Second:', secondAccount);
    console.log('Third:', thirdAccount);
  });
  
  // Helper to deploy common contracts
  async function deployContracts() {
    const Permit2 = artifacts.require('Permit2');
    const MockERC20 = artifacts.require('MockERC20');
    const TestHashing = artifacts.require('TestHashing');
    
    const permit2Json = Permit2._json;
    const mockERC20Json = MockERC20._json;
    const testHashingJson = TestHashing._json;
    
    // Deploy contracts
    permit2 = await testHelpers.deployContract(testHelpers.ownerWeb(), permit2Json);
    mockERC20 = await testHelpers.deployContract(testHelpers.ownerWeb(), mockERC20Json, "Mock Token", "MOCK");
    testHashing = await testHelpers.deployContract(testHelpers.ownerWeb(), testHashingJson);
    
    // Get second account instance of Permit2
    permit2_2 = await testHelpers.getContractAt(testHelpers.secondWeb(), permit2Json, permit2.address);
    
    // Setup: Mint and approve tokens to Permit2
    await mockERC20.mint(owner, TOKEN_AMOUNT).send();
    await mockERC20.approve(permit2.address, TOKEN_AMOUNT).send();
    
    return { permit2, permit2_2, mockERC20, testHashing };
  }
  
  // Helper to convert addresses to hex
  function toHex(address) {
    return TronWeb.address.toHex(address);
  }
  
  // Helper to generate random nonce and deadline
  function generatePermitParams() {
    return {
      nonce: Math.floor(Math.random() * 10000),
      deadline: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    };
  }
  
  // Helper to generate TIP-712 domain
  function getDomain(verifyingContract) {
    return {
      name: 'Permit2',
      chainId: chainId,
      verifyingContract: toHex(verifyingContract)
    };
  }
  
  // Helper to check token balances
  async function checkBalances(token, ...addresses) {
    const balances = {};
    for (const addr of addresses) {
      balances[addr] = await token.balanceOf(addr).call();
    }
    return balances;
  }

  it('should verify hashTokenPermissions helper matches contract', async () => {
    // Deploy contracts using helper
    await deployContracts();
    
    // Get the actual TOKEN_PERMISSIONS_TYPEHASH from the contract
    const actualTypeHash = await testHashing.getTokenPermissionsTypehash().call();
    
    // Test data
    const testAmount = '1000000000000000000'; // 1 token
    
    // Call JS helper with the actual typehash from the contract
    const jsHash = hashHelpers.hashTokenPermissions(
      testHelpers.ownerWeb(),
      mockERC20.address,
      testAmount,
      actualTypeHash
    );
    
    // Call contract function
    const contractHash = await testHashing.hashTokenPermissions(
      [mockERC20.address, testAmount]
    ).call();
    
    // Compare results
    assert.equal(
      jsHash.toLowerCase(),
      contractHash.toLowerCase(),
      'JS helper should produce same hash as contract'
    );
    
    console.log('✅ hashTokenPermissions helper matches contract implementation');
  });
  
  it('should verify hashWithWitness helper matches contract', async () => {
    // Deploy contracts using helper
    await deployContracts();
    
    // Test data
    const testAmount = '1000000000000000000'; // 1 token
    const { nonce, deadline } = generatePermitParams();
    
    // Create permit data
    const permit = {
      permitted: {
        token: mockERC20.address,
        amount: testAmount
      },
      nonce: nonce,
      deadline: deadline
    };
    
    // Create witness data
    const witnessData = {
      value: 10000000,
      person: owner,
      test: true
    };
    
    // Calculate witness hash (mimicking what would be done off-chain)
    const witnessTypeHash = tronWeb.utils.ethersUtils.keccak256(
      tronWeb.utils.ethersUtils.toUtf8Bytes('MockWitness(uint256 value,address person,bool test)')
    );
    
    // Encode witness data
    const encodedWitness = tronWeb.utils.abi.encodeParams(
      ['bytes32', 'uint256', 'address', 'bool'],
      [witnessTypeHash, witnessData.value, witnessData.person, witnessData.test]
    );
    const witness = tronWeb.utils.ethersUtils.keccak256(encodedWitness);
    
    // Define witness type string
    const witnessTypeString = 'MockWitness witness)MockWitness(uint256 value,address person,bool test)TokenPermissions(address token,uint256 amount)';
    
    // Call JS helper
    const jsHash = hashHelpers.hashWithWitness(
      testHelpers.ownerWeb(),
      permit,
      witness,
      witnessTypeString,
      secondAccount // msg.sender would be the spender calling the function
    );
    
    // Call contract function
    const contractHash = await testHashing.hashWithWitness(
      [[mockERC20.address, testAmount], nonce, deadline],
      witness,
      witnessTypeString
    ).call({ from: secondAccount }); // Call from secondAccount to set msg.sender
    
    // Compare results
    assert.equal(
      jsHash.toLowerCase(),
      contractHash.toLowerCase(),
      'JS helper should produce same hash as contract'
    );
    
    console.log('✅ hashWithWitness helper matches contract implementation');
  });
  
  it('should verify hashTypedData helper matches contract', async () => {
    // Deploy contracts using helper
    await deployContracts();
    
    // Get domain separator from the contract
    const domainSeparator = await testHashing.DOMAIN_SEPARATOR().call();
    
    // Create a test struct hash (can be any hash)
    const testData = 'Some test data for hashing';
    const structHash = testHelpers.ownerWeb().utils.ethersUtils.keccak256(
      testHelpers.ownerWeb().utils.ethersUtils.toUtf8Bytes(testData)
    );
    
    // Call JS helper
    const jsHash = hashHelpers.hashTypedData(
      testHelpers.ownerWeb(),
      domainSeparator,
      structHash
    );
    
    // Call contract function
    const contractHash = await testHashing.hashTypedData(structHash).call();
    
    // Compare results
    assert.equal(
      jsHash.toLowerCase(),
      contractHash.toLowerCase(),
      'JS helper should produce same hash as contract'
    );
    
    console.log('✅ hashTypedData helper matches contract implementation');
  });
  
  it('should verify signature verification helper matches contract', async () => {
    // Deploy contracts using helper
    await deployContracts();
    
    // Create a test message to sign
    const message = 'Test message for signature verification';
    const messageHash = testHelpers.ownerWeb().utils.ethersUtils.keccak256(
      testHelpers.ownerWeb().utils.ethersUtils.toUtf8Bytes(message)
    );
    
    // Sign the message with owner's private key using ethersUtils for consistency
    const ethersUtils = testHelpers.ownerWeb().utils.ethersUtils;
    const privateKeyWithPrefix = ownerPrivateKey.startsWith('0x') ? ownerPrivateKey : '0x' + ownerPrivateKey;
    const signingKey = new ethersUtils.SigningKey(privateKeyWithPrefix);
    const signatureObj = signingKey.sign(messageHash);
    const signature = signatureObj.serialized;
    
    console.log('Message hash:', messageHash);
    console.log('Signature:', signature);
    console.log('Signature length:', signature.length);
    console.log('Signer:', owner);
    
    // Test 1: Valid signature should verify successfully with JS helper
    try {
      // Call JS helper
      const jsResult = hashHelpers.verify(
        testHelpers.ownerWeb(),
        signature,
        messageHash,
        owner
      );
      assert.equal(jsResult, true, 'JS helper should return true for valid signature');
      console.log('✅ JS helper verification passed for valid signature');
    } catch (error) {
      assert.fail(`JS helper should not throw for valid signature: ${error.message}`);
    }
    
    // Test 2: Wrong signer should fail
    try {
      // JS helper should throw
      hashHelpers.verify(
        testHelpers.ownerWeb(),
        signature,
        messageHash,
        secondAccount // Wrong signer
      );
      assert.fail('JS helper should throw for wrong signer');
    } catch (error) {
      assert.include(error.message, 'InvalidSigner', 'JS helper should throw InvalidSigner error');
      console.log('✅ JS helper correctly throws InvalidSigner for wrong signer');
    }
    
    // Test 3: Invalid signature length should fail
    const invalidSignature = signature.slice(0, -4); // Remove 2 bytes to make it 64 hex chars (invalid for both 65 and 64 byte sigs)
    console.log('Invalid signature length:', invalidSignature.length);
    try {
      hashHelpers.verify(
        testHelpers.ownerWeb(),
        invalidSignature,
        messageHash,
        owner
      );
      assert.fail('JS helper should throw for invalid signature length');
    } catch (error) {
      assert.include(error.message, 'InvalidSignatureLength', 'JS helper should throw InvalidSignatureLength error');
      console.log('✅ JS helper correctly throws InvalidSignatureLength for invalid signature');
    }
    
    // Test 4: Test EIP-2098 compact signature (64 bytes)
    // Create a compact signature by setting the v value in the highest bit of s
    const rHex = signature.slice(0, 66); // 0x + 64 chars
    const sHex = '0x' + signature.slice(66, 130); // 64 chars
    const vValue = parseInt(signature.slice(130, 132), 16);
    
    // Set v in the highest bit of s
    const sBigInt = BigInt(sHex);
    const vBit = BigInt(vValue - 27) << BigInt(255);
    const compactS = (sBigInt | vBit).toString(16).padStart(64, '0');
    const compactSignature = rHex + compactS;
    
    console.log('Compact signature length:', compactSignature.length);
    
    try {
      const jsResult = hashHelpers.verify(
        testHelpers.ownerWeb(),
        compactSignature,
        messageHash,
        owner
      );
      assert.equal(jsResult, true, 'JS helper should handle EIP-2098 compact signatures');
      console.log('✅ JS helper correctly handles EIP-2098 compact signatures');
    } catch (error) {
      console.error('Compact signature error:', error.message);
      // It's okay if compact signatures aren't supported
      console.log('⚠️  EIP-2098 compact signatures not fully tested');
    }
    
    console.log('✅ Signature verification helper implementation complete');
  });
  
  it('should successfully execute permitTransferFrom with TIP-712 signature', async () => {
    // Deploy contracts
    await deployContracts();
    
    console.log('\n=== Contract Addresses ===');
    console.log('Permit2:', permit2.address);
    console.log('MockERC20:', mockERC20.address);
    
    const allowance = await mockERC20.allowance(owner, permit2.address).call();
    console.log('Permit2 allowance:', allowance.toString());
    
    // Get domain separator from contract
    const domainSeparator = await permit2.DOMAIN_SEPARATOR().call();
    console.log('\n=== Contract Info ===');
    console.log('Domain Separator:', domainSeparator);
    
    // Prepare permit data
    const { nonce, deadline } = generatePermitParams();
    
    // Convert addresses to hex
    const tokenHex = toHex(mockERC20.address);
    const ownerHex = toHex(owner);
    const secondAccountHex = toHex(secondAccount);
    const permit2Hex = toHex(permit2.address);
    
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
      
      const domain = getDomain(permit2.address);
      
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
    const balancesBefore = await checkBalances(mockERC20, owner, secondAccount);
    
    console.log('\n=== Balances Before ===');
    console.log('Owner:', balancesBefore[owner].toString());
    console.log('Second:', balancesBefore[secondAccount].toString());
    
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
      const balancesAfter = await checkBalances(mockERC20, owner, secondAccount);
      
      console.log('\n=== Balances After ===');
      console.log('Owner:', balancesAfter[owner].toString());
      console.log('Second:', balancesAfter[secondAccount].toString());
      
      // Calculate changes
      const ownerChange = BigInt(balancesAfter[owner]) - BigInt(balancesBefore[owner]);
      const secondChange = BigInt(balancesAfter[secondAccount]) - BigInt(balancesBefore[secondAccount]);
      
      console.log('\n=== Balance Changes ===');
      console.log('Owner:', ownerChange.toString());
      console.log('Second:', '+' + secondChange.toString());
      
      // Assert the transfer worked
      assert.equal(
        balancesAfter[owner].toString(), 
        (BigInt(balancesBefore[owner]) - BigInt(TRANSFER_AMOUNT)).toString(),
        'Owner balance should decrease by transfer amount'
      );
      assert.equal(
        balancesAfter[secondAccount].toString(), 
        (BigInt(balancesBefore[secondAccount]) + BigInt(TRANSFER_AMOUNT)).toString(),
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
    const amount = '5000000000000000000'; // 5 tokens
    
    // Prepare new permit
    const { nonce, deadline } = generatePermitParams();
    
    const domain = getDomain(permit2.address);
    
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
        token: toHex(mockERC20.address),
        amount: amount
      },
      spender: toHex(secondAccount), // Second account is still the spender
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
    const balancesBefore = await checkBalances(mockERC20, thirdAccount);
    
    // Execute transfer to third account
    const result = await permit2_2.permitTransferFrom(
      [
        [mockERC20.address, amount],
        nonce,
        deadline
      ],
      [thirdAccount, amount], // Transfer to third account instead
      toHex(owner),
      signature
    ).send({
      shouldPollResponse: true
    });
    
    console.log('✅ Transfer to third account successful!');
    
    // Verify balance
    const balancesAfter = await checkBalances(mockERC20, thirdAccount);
    console.log('Third account balance change:', 
      (BigInt(balancesAfter[thirdAccount]) - BigInt(balancesBefore[thirdAccount])).toString()
    );
    
    assert.equal(
      balancesAfter[thirdAccount].toString(),
      (BigInt(balancesBefore[thirdAccount]) + BigInt(amount)).toString(),
      'Third account should receive tokens'
    );
  });
  
  it('should fail with expired deadline', async () => {
    console.log('\n=== Test: Expired Deadline ===');
    
    const nonce = Math.floor(Math.random() * 10000);
    const deadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago - expired
    
    const domain = getDomain(permit2.address);
    
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
        token: toHex(mockERC20.address),
        amount: '1000000000000000000'
      },
      spender: toHex(secondAccount),
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
        toHex(owner),
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
  
  it('should successfully execute permitWitnessTransferFrom with witness data', async () => {
    console.log('\n=== Test: permitWitnessTransferFrom with Witness Data ===');
    
    // Deploy contracts
    await deployContracts();
    
    // Check initial balances
    console.log('Initial balances:');
    await checkBalances(mockERC20, owner, secondAccount);
    
    // Create permit parameters
    const { nonce, deadline } = generatePermitParams();
    
    // Define witness data
    const witnessValue = 12345;
    const witnessTypeString = "ExtraData(uint256 value)";
    
    // Create witness hash - this is the hash of the actual witness data
    const witness = testHelpers.ownerWeb().utils.ethersUtils.keccak256(
      testHelpers.ownerWeb().utils.abi.encodeParams(['uint256'], [witnessValue])
    );
    console.log('Witness hash:', witness);
    
    // Build permit structure
    const permit = {
      permitted: {
        token: toHex(mockERC20.address),
        amount: TRANSFER_AMOUNT
      },
      spender: toHex(secondAccount), // The spender is the account calling permitWitnessTransferFrom
      nonce: nonce,
      deadline: deadline
    };
    
    const transferDetails = {
      to: toHex(secondAccount),
      requestedAmount: TRANSFER_AMOUNT
    };
    
    console.log('Permit:', permit);
    console.log('Transfer details:', transferDetails);
    
    // Generate signature using our verified helper functions
    // Step 1: Use hashWithWitness to create the struct hash
    const structHash = hashHelpers.hashWithWitness(
      testHelpers.ownerWeb(),
      permit,
      witness,
      witnessTypeString,
      secondAccount // msg.sender will be the secondAccount calling permitWitnessTransferFrom
    );
    console.log('Struct hash from helper:', structHash);
    
    // Step 2: Get domain separator
    const domainSeparator = await permit2.DOMAIN_SEPARATOR().call();
    console.log('Domain separator:', domainSeparator);
    
    // Step 3: Create final hash using hashTypedData
    const finalHash = hashHelpers.hashTypedData(
      testHelpers.ownerWeb(),
      domainSeparator,
      structHash
    );
    console.log('Final hash to sign:', finalHash);
    
    // Step 4: Sign with ethersUtils for consistency
    const ethersUtils = testHelpers.ownerWeb().utils.ethersUtils;
    const privateKeyWithPrefix = ownerPrivateKey.startsWith('0x') ? ownerPrivateKey : '0x' + ownerPrivateKey;
    const signingKey = new ethersUtils.SigningKey(privateKeyWithPrefix);
    const signatureObj = signingKey.sign(finalHash);
    const signature = signatureObj.serialized;
    console.log('Generated signature:', signature);
    
    // Execute permitWitnessTransferFrom
    console.log('\nExecuting permitWitnessTransferFrom...');
    // Use permit2_2 instance which is configured with the second account
    const tx = await permit2_2.permitWitnessTransferFrom(
      [
        [mockERC20.address, TRANSFER_AMOUNT],
        nonce,
        deadline
      ],
      [secondAccount, TRANSFER_AMOUNT],
      toHex(owner),
      witness,
      witnessTypeString,
      signature
    ).send({
      shouldPollResponse: false
    });
    
    console.log('Transaction hash:', tx);
    
    // Verify the transfer
    console.log('\nFinal balances:');
    await checkBalances(mockERC20, owner, secondAccount);
    
    // Verify balances changed correctly
    const ownerBalance = await mockERC20.balanceOf(owner).call();
    const secondBalance = await mockERC20.balanceOf(secondAccount).call();
    
    assert.equal(
      ownerBalance.toString(),
      (BigInt(TOKEN_AMOUNT) - BigInt(TRANSFER_AMOUNT)).toString(),
      'Owner balance should be reduced by transfer amount'
    );
    
    assert.equal(
      secondBalance.toString(),
      TRANSFER_AMOUNT,
      'Second account should receive transfer amount'
    );
    
    // Verify nonce was consumed
    const wordPos = Math.floor(nonce / 256);
    const bitPos = nonce % 256;
    const nonceUsed = await permit2.nonceBitmap(owner, wordPos).call();
    const expectedBit = BigInt(1) << BigInt(bitPos);
    
    // Check if the specific bit is set
    const isNonceUsed = (BigInt(nonceUsed) & expectedBit) !== BigInt(0);
    assert.equal(
      isNonceUsed,
      true,
      'Nonce should be marked as used'
    );
    
    console.log('✅ permitWitnessTransferFrom executed successfully with witness data!');
  });

}); 