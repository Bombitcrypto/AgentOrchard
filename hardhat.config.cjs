require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true
    }
  },
  networks: { bscMainnet: {
    url: process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed.bnbchain.org',
    chainId: 56,
    accounts: process.env.MAINNET_DEPLOYER_PRIVATE_KEY ? [process.env.MAINNET_DEPLOYER_PRIVATE_KEY] : []
  }},
  etherscan: { apiKey:process.env.ETHERSCAN_API_KEY || process.env.BSCSCAN_API_KEY || ''},
  sourcify: { enabled: false }
};
