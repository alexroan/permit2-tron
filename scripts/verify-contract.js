#!/usr/bin/env node

/**
 * Contract Verification Script
 * 
 * This script verifies that the compiled Permit2 contract bytecode matches
 * the bytecode deployed on Tron Mainnet. It:
 * 1. Cleans existing build artifacts
 * 2. Compiles the contract using tronbox
 * 3. Fetches the on-chain bytecode from mainnet
 * 4. Compares the compiled bytecode with the on-chain bytecode
 * 
 * Note: On Tron, the bytecode stored on-chain is the deployment bytecode
 * (which includes constructor code), not just the runtime bytecode.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { TronWeb } = require('tronweb');

// Configuration
const MAINNET_CONTRACT_ADDRESS = 'TJhMXTHQHeQyMD7TcKQFqAePNgG4b31H9m';
const MAINNET_RPC_URL = 'https://api.trongrid.io';
const BUILD_DIR = path.join(__dirname, '..', 'build');
const CONTRACT_JSON_PATH = path.join(BUILD_DIR, 'contracts', 'Permit2.json');

// Compilation settings used (must match tronbox-config.js)
const COMPILATION_SETTINGS = {
  compiler: 'solc',
  version: '0.8.23',
  optimizer: {
    enabled: true,
    runs: 1000000
  },
  viaIR: true,
  bytecodeHash: 'none'
};

/**
 * Clean build directory
 */
function cleanBuild() {
  console.log('🧹 Cleaning build artifacts...');
  try {
    if (fs.existsSync(BUILD_DIR)) {
      fs.rmSync(BUILD_DIR, { recursive: true, force: true });
    }
    console.log('✅ Build directory cleaned\n');
  } catch (error) {
    console.error('❌ Error cleaning build directory:', error.message);
    process.exit(1);
  }
}

/**
 * Compile contracts using tronbox
 */
function compileContracts() {
  console.log('🔨 Compiling contracts with TronBox...');
  console.log('   Settings:');
  console.log(`   - Solidity: ${COMPILATION_SETTINGS.version}`);
  console.log(`   - Optimizer: Enabled (${COMPILATION_SETTINGS.optimizer.runs.toLocaleString()} runs)`);
  console.log(`   - Via IR: ${COMPILATION_SETTINGS.viaIR}`);
  console.log(`   - Bytecode Hash: ${COMPILATION_SETTINGS.bytecodeHash}\n`);
  
  try {
    execSync('tronbox compile', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ Compilation completed\n');
  } catch (error) {
    console.error('❌ Compilation failed:', error.message);
    process.exit(1);
  }
}

/**
 * Read compiled bytecode from build artifacts
 */
function getCompiledBytecode() {
  console.log('📖 Reading compiled bytecode...');
  
  if (!fs.existsSync(CONTRACT_JSON_PATH)) {
    console.error(`❌ Contract JSON not found at: ${CONTRACT_JSON_PATH}`);
    console.error('   Please ensure compilation completed successfully.');
    process.exit(1);
  }
  
  try {
    const contractJson = JSON.parse(fs.readFileSync(CONTRACT_JSON_PATH, 'utf8'));
    const compiledBytecode = contractJson.bytecode;
    
    if (!compiledBytecode) {
      console.error('❌ bytecode field not found in contract JSON');
      process.exit(1);
    }
    
    // Remove '0x' prefix if present
    const bytecode = compiledBytecode.startsWith('0x') 
      ? compiledBytecode.slice(2) 
      : compiledBytecode;
    
    console.log(`✅ Compiled bytecode loaded (${bytecode.length} hex characters)\n`);
    return bytecode;
  } catch (error) {
    console.error('❌ Error reading compiled bytecode:', error.message);
    process.exit(1);
  }
}

/**
 * Fetch on-chain bytecode from Tron Mainnet
 */
async function getOnChainBytecode() {
  console.log('🌐 Fetching on-chain bytecode from Tron Mainnet...');
  console.log(`   Contract Address: ${MAINNET_CONTRACT_ADDRESS}\n`);
  
  try {
    const tronWeb = new TronWeb({
      fullHost: MAINNET_RPC_URL
    });
    
    // Get contract info which includes bytecode
    const contract = await tronWeb.trx.getContract(MAINNET_CONTRACT_ADDRESS);
    
    if (!contract || !contract.bytecode) {
      console.error('❌ Contract not found or bytecode not available');
      console.error('   Please verify the contract address is correct.');
      process.exit(1);
    }
    
    // Remove '0x' prefix if present
    const bytecode = contract.bytecode.startsWith('0x')
      ? contract.bytecode.slice(2)
      : contract.bytecode;
    
    console.log(`✅ On-chain bytecode fetched (${bytecode.length} hex characters)\n`);
    return bytecode;
  } catch (error) {
    console.error('❌ Error fetching on-chain bytecode:', error.message);
    console.error('   Please check your internet connection and try again.');
    process.exit(1);
  }
}

/**
 * Compare bytecodes and report results
 */
function compareBytecodes(compiledBytecode, onChainBytecode) {
  console.log('🔍 Comparing bytecodes...\n');
  
  if (compiledBytecode === onChainBytecode) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ VERIFICATION SUCCESSFUL');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('The compiled bytecode matches the on-chain bytecode.');
    console.log('This confirms that the source code in this repository');
    console.log('matches the contract deployed on Tron Mainnet.');
    console.log('');
    console.log(`Contract Address: ${MAINNET_CONTRACT_ADDRESS}`);
    console.log(`Network: Tron Mainnet`);
    console.log('');
    console.log('Compilation Settings:');
    console.log(`  - Solidity Version: ${COMPILATION_SETTINGS.version}`);
    console.log(`  - Optimizer: Enabled (${COMPILATION_SETTINGS.optimizer.runs.toLocaleString()} runs)`);
    console.log(`  - Via IR: ${COMPILATION_SETTINGS.viaIR}`);
    console.log(`  - Bytecode Hash: ${COMPILATION_SETTINGS.bytecodeHash}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    return true;
  } else {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('❌ VERIFICATION FAILED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('The compiled bytecode does NOT match the on-chain bytecode.');
    console.log('');
    console.log('Possible reasons:');
    console.log('  1. Source code has been modified since deployment');
    console.log('  2. Compilation settings differ from deployment');
    console.log('  3. Different compiler version was used');
    console.log('  4. Contract at address is not the Permit2 contract');
    console.log('');
    console.log(`Compiled bytecode length: ${compiledBytecode.length} hex chars`);
    console.log(`On-chain bytecode length: ${onChainBytecode.length} hex chars`);
    console.log('');
    
    // Find first difference
    const minLength = Math.min(compiledBytecode.length, onChainBytecode.length);
    for (let i = 0; i < minLength; i += 2) {
      const compiledChunk = compiledBytecode.slice(i, i + 2);
      const onChainChunk = onChainBytecode.slice(i, i + 2);
      if (compiledChunk !== onChainChunk) {
        console.log(`First difference at position ${i}:`);
        console.log(`  Compiled:  ${compiledChunk}`);
        console.log(`  On-chain:  ${onChainChunk}`);
        break;
      }
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    return false;
  }
}

/**
 * Main verification function
 */
async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║      Permit2 Contract Verification - Tron Mainnet        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Step 1: Clean build
  cleanBuild();
  
  // Step 2: Compile contracts
  compileContracts();
  
  // Step 3: Get compiled bytecode
  const compiledBytecode = getCompiledBytecode();
  
  // Step 4: Get on-chain bytecode
  const onChainBytecode = await getOnChainBytecode();
  
  // Step 5: Compare
  const matches = compareBytecodes(compiledBytecode, onChainBytecode);
  
  // Exit with appropriate code
  process.exit(matches ? 0 : 1);
}

// Run verification
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

