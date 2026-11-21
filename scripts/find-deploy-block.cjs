/** Read-only: discover BSC deployment block from existing deployment receipt. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const HASH=/^0x[0-9a-fA-F]{64}$/;
(async()=>{
  const deployment=path.resolve(__dirname,'../deployment-mainnet.json');
  let hash=process.argv[2];
  if(!hash && fs.existsSync(deployment)) hash=JSON.parse(fs.readFileSync(deployment,'utf8')).txHash;
  if(!HASH.test(hash||'')) throw Error('Usage: npm run find:block -- 0xYOUR_DEPLOY_TX_HASH (or put deployment-mainnet.json in project root)');
  const endpoint=process.env.BSC_MAINNET_RPC||'https://bsc-dataseed.bnbchain.org/';
  const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getTransactionReceipt',params:[hash]}),signal:AbortSignal.timeout(15000)});
  if(!res.ok) throw Error('RPC HTTP '+res.status);
  const data=await res.json();
  if(data.error || !data.result)throw Error(data.error?.message||'No deployment receipt found');
  if(data.result.status!=='0x1') throw Error('Deployment transaction did not succeed');
  if(data.result.to)throw Error('Supplied transaction is not a contract creation transaction');
  console.log('Deployment tx:',hash);
  console.log('Block (decimal):',Number(BigInt(data.result.blockNumber)));
  console.log('Created contract:',data.result.contractAddress);
  console.log('Use this block as START_BLOCK in analytics-worker/wrangler.toml');
})().catch(err=>{console.error('ERROR:',err.message);process.exitCode=1;});
