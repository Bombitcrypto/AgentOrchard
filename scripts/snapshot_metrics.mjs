#!/usr/bin/env node
/**
 * Agent Orchard evidence capture. Node 20+; only GET calls, no secrets/private keys.
 * Usage: node tools/snapshot_metrics.mjs
 * Writes dated JSON and CSV to evidence/ for your own verification, not a certificate.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname0 = dirname(fileURLToPath(import.meta.url));
const evidenceDir = resolve(dirname0,'..','evidence');
const base = 'https://agentorchard-analytics.ryeoanh.workers.dev';
const origin = 'https://agentorchard.pages.dev';
const contract = '0x185E900b5986362f8D8eaC4c4294AbA11D62a997';
const capturedAt = new Date().toISOString();
const tag = capturedAt.replace(/[.:]/g, '-');
const targets = {
  health: '/api/health',
  stats: '/api/stats',
  leaderboard: '/api/leaderboard?limit=50&sort=xp'
};
async function pull(path){
 const response = await fetch(base+path,{
  headers:{ Origin:origin, Accept:'application/json'},
  signal:AbortSignal.timeout(25000)
 });
 const body = await response.text();
 if(!response.ok) throw new Error(`GET ${path}: HTTP ${response.status}: ${body.slice(0,400)}`);
 const decoded = JSON.parse(body);
 if(decoded.error) throw new Error(`GET ${path}: ${decoded.error}`);
 return decoded;
}
function csvField(x){const s=String(x??'');return /[,\n\r"]/.test(s)?`"${s.replaceAll('"','""')}"`:s}
try {
 const [health, stats, leaderboard] = await Promise.all(Object.values(targets).map(pull));
 if(String(health.contract||'').toLowerCase() !== contract.toLowerCase() || Number(health.chainId)!==56) {
  throw new Error('Contract or chain mismatch; refusing to write an evidence snapshot.');
 }
 const rows = Array.isArray(leaderboard.rows)?leaderboard.rows:[];
 const complete = Boolean(health.indexer?.complete);
 const distinct = new Set(rows.map(r=>String(r.wallet||'').toLowerCase())).size;
 const dataset = {
  capturedAtUTC:capturedAt,source:base,siteOrigin:origin,contract,chainId:56,
  caveats:[
   'This snapshot captures the public Worker API, not independent BscScan verification.',
   'Leaderboard returns at most 50 wallets; DO NOT use row count to claim totals beyond 50.',
   'Indexer counts are provisional unless indexer.complete is true at the snapshot time.',
   'Wallet != unique person. Website traffic != Agent ID wallet count.',
   'Eligibility also requires actual Agent ID holdings and interactions during the submission period.'
  ],health,stats,leaderboard
 };
 await mkdir(evidenceDir,{recursive:true});
 const jsonPath=resolve(evidenceDir,`metrics_${tag}.json`);
 await writeFile(jsonPath,JSON.stringify(dataset,null,2)+'\n');
 const fields=['wallet','agentIdName','xp','checkins','plants','tends','harvests','badges','bestStreak','lastBlock'];
 const csv=[fields.join(','),...rows.map(r=>fields.map(f=>csvField(r[f])).join(','))].join('\n')+'\n';
 const csvPath=resolve(evidenceDir,`leaderboard_${tag}.csv`);
 await writeFile(csvPath,csv);
 console.log('Agent Orchard public snapshot captured:',capturedAt);
 console.log('Contract/chain:',contract,'/',health.chainId);
 console.log('Indexer complete:',complete,'cursor:',health.indexer?.cursor,'head:',health.indexer?.head);
 console.log('Reported chain-event totals:',JSON.stringify(stats.onchain));
 console.log('Leaderboard rows returned:',rows.length,' distinct addresses in returned rows:',distinct);
 console.log('NOT a full campaign-period Agent ID eligibility audit.');
 console.log('Files:',jsonPath,'and',csvPath);
 if(!complete) console.log('WARNING: Indexer has not caught up; do not label metrics as final.');
} catch(err) {
 console.error('Snapshot FAILED:',err.message);
 process.exitCode = 1;
}
