// scripts/check-usdt-balance.js
const { TronWeb } = require('tronweb');

const USDT_ADDRESS = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
const MY_ADDRESS = 'TR6y9bCmyGBvb3ALZSwVJkw8YThbwmFX8N';

const tronWeb = new TronWeb({
  fullHost: 'https://nile.trongrid.io'
});

// Set a default address (can be any valid address since we're just reading)
tronWeb.setAddress(MY_ADDRESS);

async function checkBalance() {
  // Simple TRC20 balanceOf ABI
  const abi = [{
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  }];
  
  const contract = await tronWeb.contract(abi, USDT_ADDRESS);
  const balance = await contract.balanceOf(MY_ADDRESS).call();
  
  // USDT has 6 decimals
  const formatted = (BigInt(balance) / BigInt(1e6)).toString();
  const remainder = (BigInt(balance) % BigInt(1e6)).toString().padStart(6, '0');
  
  console.log(`USDT Balance: ${formatted}.${remainder}`);
  console.log(`Raw: ${balance}`);
}

checkBalance().catch(console.error); 