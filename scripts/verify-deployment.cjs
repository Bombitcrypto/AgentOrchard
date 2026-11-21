'use strict';
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');
const official = '0x60b9262456de011f7d15a54cdd8c48baaa8b022f';
const knownWrong = '0xCdDC5Fe00349c5594858f145451f254F184fe1e8';
const config = fs.readFileSync(path.resolve(__dirname, '../site/config.js'), 'utf8');
const configured = config.match(/\bCONTRACT\s*:\s*['"](0x[0-9a-fA-F]{40})['"]/i)?.[1];
const address = process.argv[2] || configured;
const fail = msg => { throw Error(msg); };
(async () => {
  if (!address || !ethers.isAddress(address)) fail('Provide a valid deployed contract address or set CONTRACT in site/config.js');
  if (address.toLowerCase() === knownWrong.toLowerCase()) fail('Old AgentProof address cannot be used as AgentOrchard');
  const provider = new ethers.JsonRpcProvider(process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed.bnbchain.org', { chainId: 56, name: 'bsc' });
  const network = await provider.getNetwork();
  if (network.chainId !== 56n) fail('Wrong chain; must be BNB Mainnet 56');
  const code = await provider.getCode(address);
  if (code === '0x') fail('Address has no deployed contract bytecode');
  const idCode = await provider.getCode(official);
  if (idCode === '0x') fail('Official Agent ID registry unavailable');
  const contract = new ethers.Contract(address, [
    'function agentId() view returns(address)',
    'function name() pure returns(string)',
    'function nextTreeId() view returns(uint256)',
    'function nextBadgeTokenId() view returns(uint256)',
    'function totalCheckIns() view returns(uint256)',
    'function totalHarvests() view returns(uint256)',
    'function supportsInterface(bytes4) view returns(bool)'
  ], provider);
  if ((await contract.agentId()).toLowerCase() !== official.toLowerCase()) fail('Wrong Agent ID dependency');
  if (await contract.name() !== 'Agent Orchard Streak Badges') fail('Unexpected contract name');
  if (!await contract.supportsInterface('0xb45a3c0e')) fail('Missing soulbound ERC-5192 interface');
  const details = {
    chainId: 56, address, agentId: official,
    nextTreeId: String(await contract.nextTreeId()),
    nextBadgeTokenId: String(await contract.nextBadgeTokenId()),
    totalCheckIns: String(await contract.totalCheckIns()),
    totalHarvests: String(await contract.totalHarvests())
  };
  console.log(JSON.stringify(details, null, 2));
  if (configured && address.toLowerCase() !== configured.toLowerCase()) {
    console.warn('WARNING: site/config.js CONTRACT does not match the verified address.');
  }
  console.log('RPC checks PASS. Verify the source is publicly verified on BscScan separately.');
})().catch(error => { console.error('VERIFY FAILED:', error.message); process.exitCode = 1; });
