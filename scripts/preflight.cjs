#!/usr/bin/env node
'use strict';
// This check must NOT require hardhat.config.cjs. Hardhat plugins need the
// Hardhat CLI's initialized context; requiring the config directly causes HH5.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const configFile = path.join(root, 'hardhat.config.cjs');
const contractFile = path.join(root, 'contracts', 'AgentOrchard.sol');

function fail(message) {
  console.error('[AGENT ORCHARD: FAIL]', message);
  console.error('Project root:', root);
  console.error('Hardhat config:', configFile);
  process.exit(1);
}
if (!fs.existsSync(configFile)) fail('hardhat.config.cjs is missing.');
if (!fs.existsSync(contractFile)) fail('contracts/AgentOrchard.sol is missing.');

const configText = fs.readFileSync(configFile, 'utf8');
try {
  // Syntax-only check: never execute the config or load Hardhat plugins here.
  new vm.Script(configText, { filename: configFile });
} catch (error) {
  fail('Invalid JavaScript syntax in hardhat.config.cjs: ' + error.message);
}
const compiler = configText.match(/\bversion\s*:\s*['"]([^'"]+)['"]/);
const optimizerEnabled = /\boptimizer\s*:\s*\{\s*enabled\s*:\s*true\b/.test(configText);
const viaIREnabled = /\bviaIR\s*:\s*true\b/.test(configText);
console.log('Project root:', root);
console.log('Hardhat config:', configFile);
console.log('Solidity version (static check):', compiler ? compiler[1] : 'not detected');
console.log('Optimizer enabled (static check):', optimizerEnabled);
console.log('viaIR enabled (static check):', viaIREnabled);
if (!optimizerEnabled || !viaIREnabled) {
  fail('Enable optimizer { enabled: true, runs: 200 } and viaIR: true in Solidity settings.');
}

let hardhatLocation;
try {
  // resolve() only; do not import/execute Hardhat from this preflight script.
  hardhatLocation = require.resolve('hardhat', { paths: [root] });
} catch {
  fail('Hardhat is not installed in this project. Run npm install inside the project folder.');
}
console.log('Hardhat installed:', hardhatLocation);

const source = fs.readFileSync(contractFile, 'utf8');
if (!source.includes('0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F')) {
  fail('The Agent ID address checksum fix is missing in contracts/AgentOrchard.sol');
}
if (source.includes('Agent Orchard —') || source.includes('Agent Orchard –')) {
  fail('Unicode punctuation bug remains in Solidity NFT metadata');
}
console.log('[AGENT ORCHARD: OK] Static preflight passed without initializing Hardhat.');
console.log('NOTE: Full Solidity compilation and EVM tests still need to be run.');
