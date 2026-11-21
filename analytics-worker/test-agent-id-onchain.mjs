import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./src.js',import.meta.url),'utf8');
const {resolveAgentName,forwardAgentName,withAgentNames}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const env={RPC_URL:'https://example-rpc.invalid'};
const w='0xf972742fC196a8b4a8B2bAd1a3aa4aC2e1eDEADa';
const w2='0xcd710a311aedb31068661b6c8dfcdaff555b806a';
const word=x=>BigInt(x).toString(16).padStart(64,'0');
const stringResult=handle=>{
  const hex=[...new TextEncoder().encode(handle)].map(n=>n.toString(16).padStart(2,'0')).join('');
  return '0x'+word(32)+word(hex.length/2)+hex.padEnd(Math.ceil(hex.length/64)*64,'0');
};
const addressResult=address=>'0x'+address.slice(2).toLowerCase().padStart(64,'0');
const originalFetch=globalThis.fetch;
let reverseHandle='SignalX', owner=w, calls=[];
try {
  globalThis.fetch=async (url,opts)=>{
    const req=JSON.parse(opts.body);calls.push(req);
    assert.equal(req.method,'eth_call');
    assert.equal(req.params[0].to.toLowerCase(),'0x60b9262456de011f7d15a54cdd8c48baaa8b022f');
    let result;
    if(req.params[0].data.startsWith('0xc50a1514')) {
      const address='0x'+req.params[0].data.slice(-40).toLowerCase();
      result=stringResult(address===w.toLowerCase() ? reverseHandle : '');
    } else if(req.params[0].data.startsWith('0x1da94fb4')) {
      const calldata=req.params[0].data.slice(10);
      assert.equal(calldata.slice(0,64),word(32));
      const len=Number(BigInt('0x'+calldata.slice(64,128)));
      const handle=Buffer.from(calldata.slice(128,128+2*len),'hex').toString('utf8');
      result=addressResult(handle.toLowerCase()==='signalx' ? owner : '0x0000000000000000000000000000000000000000');
    } else throw Error('unknown selector: '+req.params[0].data.slice(0,10));
    return new Response(JSON.stringify({jsonrpc:'2.0',id:1,result}),{status:200});
  };
  assert.equal(await resolveAgentName(w,env),'SignalX.ai');
  assert.equal(await forwardAgentName('SignalX.ai',env),w.toLowerCase());
  // Case folding also works for user-supplied lowercase aliases.
  assert.equal(await forwardAgentName('signalx.ai',env),w.toLowerCase());
  const rows=await withAgentNames([{wallet:w,xp:10},{wallet:w2,xp:0}],env);
  assert.equal(rows[0].agentIdName,'SignalX.ai');
  assert.equal(rows[1].agentIdName,null);
  assert(calls.some(c=>c.params[0].data.startsWith('0xc50a1514')));
  assert(calls.some(c=>c.params[0].data.startsWith('0x1da94fb4')));
  // Never show a name when ownerOfHandle points to another wallet.
  owner=w2;
  assert.equal(await resolveAgentName(w,env),null);
  owner=w;
  reverseHandle='';
  assert.equal(await resolveAgentName(w,env),null);
  reverseHandle='SignalX';
  globalThis.fetch=async()=>new Response(JSON.stringify({jsonrpc:'2.0',id:1,error:{code:-32000,message:'rate limited'}}),{status:200});
  assert.equal(await resolveAgentName(w,env),null, 'RPC failure cannot produce a fabricated name');
  assert.equal(await resolveAgentName('invalid',env),null);
  console.log('PASS: ABI selectors, dynamic string decode, registry reverse lookup, forward verification, fallback, invalid address, RPC failure');
} finally {globalThis.fetch=originalFetch;}
