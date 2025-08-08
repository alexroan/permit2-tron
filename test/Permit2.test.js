const testHelpers = require('./test-helpers');

// Helper functions that mimic on-chain library functions
const hashHelpers = {
  // Mimics PermitHash._hashTokenPermissions
  hashTokenPermissions: (tronWeb, token, amount, typeHash = null) => {
    // TOKEN_PERMISSIONS_TYPEHASH = keccak256("TokenPermissions(address token,uint256 amount)")
    const TOKEN_PERMISSIONS_TYPEHASH = typeHash || ('0x' + tronWeb.sha3('TokenPermissions(address token,uint256 amount)', false));
    
    // Convert token address to hex if needed
    const tokenHex = token.startsWith('0x') ? token : tronWeb.address.toHex(token);
    
    // Convert address to uint160 by removing the 41 prefix and converting to BigInt
    const tokenWithout41 = '0x' + tokenHex.slice(2);
    const tokenBigInt = BigInt(tokenWithout41).toString();
    
    // Encode: typehash, token as uint160, amount
    const encoded = tronWeb.utils.abi.encodeParams(
      ['bytes32', 'uint160', 'uint256'],
      [TOKEN_PERMISSIONS_TYPEHASH, tokenBigInt, amount]
    );
    
    // Return keccak256 hash using ethersUtils (TronWeb.sha3 has issues with 0x prefix)
    return tronWeb.utils.ethersUtils.keccak256(encoded);
  },
  
  // Mimics PermitHash.hashWithWitness
  hashWithWitness: (tronWeb, permit, witness, witnessTypeString, msgSender) => {
    // Calculate the permit type hash
    const PERMIT_TRANSFER_FROM_WITNESS_TYPEHASH_STUB = 
      "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,";
    const typeHash = tronWeb.utils.ethersUtils.keccak256(
      tronWeb.utils.ethersUtils.toUtf8Bytes(PERMIT_TRANSFER_FROM_WITNESS_TYPEHASH_STUB + witnessTypeString)
    );
    
    // Calculate token permissions hash
    const tokenPermissionsHash = hashHelpers.hashTokenPermissions(
      tronWeb,
      permit.permitted.token,
      permit.permitted.amount
    );
    
    // Convert msg.sender to uint160
    const msgSenderHex = msgSender.startsWith('0x') ? msgSender : tronWeb.address.toHex(msgSender);
    const msgSenderWithout41 = '0x' + msgSenderHex.slice(2);
    const msgSenderBigInt = BigInt(msgSenderWithout41).toString();
    
    // Encode the permit data
    const encoded = tronWeb.utils.abi.encodeParams(
      ['bytes32', 'bytes32', 'uint160', 'uint256', 'uint256', 'bytes32'],
      [typeHash, tokenPermissionsHash, msgSenderBigInt, permit.nonce, permit.deadline, witness]
    );
    
    // Return keccak256 hash
    return tronWeb.utils.ethersUtils.keccak256(encoded);
  },
  
  // Mimics TIP712._hashTypedData
  hashTypedData: (tronWeb, domainSeparator, structHash) => {
    // Encode according to EIP-712/TIP-712 standard
    // "\x19\x01" + domainSeparator + structHash
    const encoded = '0x1901' + domainSeparator.slice(2) + structHash.slice(2);
    
    // Return keccak256 hash
    return tronWeb.utils.ethersUtils.keccak256(encoded);
  }
};

contract('Permit2 - TIP-712 Compliant', () => {
  let permit2, permit2_2;
  let mockERC20;
  let testHashing;
  let owner, secondAccount, thirdAccount;
  let ownerPrivateKey;
  let TronWeb;
  let chainId = 3360022319; // Local testnet chainId
  
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
  
  it.skip('should successfully execute permitTransferFrom with TIP-712 signature', async () => {
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
  
  it.skip('should allow transfer to a different recipient', async () => {
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
  
  it.skip('should fail with expired deadline', async () => {
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
}); 