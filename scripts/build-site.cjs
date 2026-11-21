'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'site');
const destination = path.join(root, 'dist');
const configSource = fs.readFileSync(path.join(source, 'config.js'), 'utf8');
const match = configSource.match(/\bCONTRACT\s*:\s*['"](0x[0-9a-fA-F]{40})['"]/);
const bad = '0xCdDC5Fe00349c5594858f145451f254F184fe1e8';
if (!match) throw Error('Set the NEW verified mainnet AgentOrchard CONTRACT in site/config.js before building public website.');
if (match[1].toLowerCase() === bad.toLowerCase()) throw Error('The old AgentProof contract is NOT AgentOrchard.');
if (process.env.AGENT_ORCHARD_CONTRACT && process.env.AGENT_ORCHARD_CONTRACT.toLowerCase() !== match[1].toLowerCase()) {
  throw Error('AGENT_ORCHARD_CONTRACT env does not match site/config.js');
}
fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
console.log('Cloudflare Pages files ready:', destination);
console.log('Contract:', match[1]);
console.log('IMPORTANT: run verify:deployment and confirm BscScan source verification before uploading.');
