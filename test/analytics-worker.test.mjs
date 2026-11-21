import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../analytics-worker/src.js',import.meta.url),'utf8');
const {decodeLog,indexEvents,default:worker}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const P={
  checkin:'0x41b3438661f26a3a01f996c4f1e64c88e03fa6f288e63d9d9130507da11f682e',
  plant:'0xfd9ee941c3e90ea0311ceac27dbf6480b6a7c67192df2eb53bb663e043d080c3',
  tend:'0x60873ba626bee4068c437d7c94a19a23c9c1a5337f6ce55a6a7692cc8c5b3bdc',
  harvest:'0x003d202daac80d3a11461291e5ca580e833255cfccff45fcf3ff510715dfe975',
  badge:'0x6e79522d33e3590933a0f11623ebc984abab3d341dd3e9b88e4e2503b15d9ab6'
};
const wallet='0x1234567890abcdef1234567890abcdef12345678';
const pad=n=>BigInt(n).toString(16).padStart(64,'0');
const base=(type,data,idx=0)=>({address:'0x185E900b5986362f8D8eaC4c4294AbA11D62a997',topics:[P[type],'0x'+wallet.slice(2).padStart(64,'0'),...(type==='checkin'?['0x'+pad(20777)]:[])],data:'0x'+data.map(pad).join(''),blockNumber:'0x30',logIndex:'0x'+idx.toString(16),transactionHash:'0x'+'b'.repeat(64)});
test('decode all five events with correct XP / streak and wallet',()=>{
  const rows=[base('checkin',[4,3,4,2]),base('plant',[1],1),base('tend',[2],2),base('harvest',[10],3),base('badge',[3],4)];
  const decoded=rows.map(decodeLog);
  assert.deepEqual(decoded.map(d=>d.action),['checkin','plant','tend','harvest','badge']);
  assert.deepEqual(decoded.map(d=>d.xp),[10,15,20,50,300]);
  assert.equal(decoded[0].streak,4);
  assert.equal(decoded[0].utcDay,20777);
  assert.ok(decoded.every(d=>d.wallet===wallet));
  assert.equal(new Set(decoded.map(d=>d.id)).size,5);
});
test('ignore unrelated topic and reject malformed tier',()=>{
  assert.equal(decodeLog({...base('plant',[1]),topics:['0x'+'0'.repeat(64),'0x'+wallet.slice(2).padStart(64,'0')]}),null);
  assert.throws(()=>decodeLog(base('badge',[9])),/Unknown badge tier/);
});
test('read-only indexer checks chain 56 and stores cursor only after inserting events',async()=>{
  let cursor=null,info=null;const stored=new Map();const original=globalThis.fetch;
  const mockRpc=async(url,opt)=>{const req=JSON.parse(opt.body);let out;
    if(req.method==='eth_chainId')out='0x38';
    else if(req.method==='eth_blockNumber')out='0x4e2'; // 1250, with 15 blocks finality => 1235
    else if(req.method==='eth_getLogs'){out=[base('checkin',[4,3,4,2])];}
    return new Response(JSON.stringify({jsonrpc:'2.0',id:1,result:out}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  function prepare(q){
    return {bind(...args){this.args=args;return this;},async first(){if(q.includes("key='cursor'"))return cursor!==null?{value:String(cursor)}:null;return null;},async run(){
      if(q.startsWith('INSERT OR IGNORE INTO chain_events'))stored.set(this.args[0],this.args);
      else if(q.includes("VALUES('cursor'"))cursor=Number(this.args[0]);
      else if(q.includes("VALUES('status'"))info=JSON.parse(this.args[0]);
      return {success:true};
    }};
  }
  const env={DB:{prepare,async batch(queries){for(const q of queries)await q.run();}},RPC_URL:'https://rpc.example.com/',ORCHARD_CONTRACT:'0x185E900b5986362f8D8eaC4c4294AbA11D62a997',START_BLOCK:'1200',BLOCK_STEP:'1000',MAX_CHUNKS:'1'};
  try {
    globalThis.fetch=mockRpc;
    const r=await indexEvents(env);
    assert.equal(r.complete,true);assert.equal(cursor,1235);assert.equal(stored.size,1);assert.equal(info.indexedEvents,1);
    const r2=await indexEvents(env);
    assert.equal(r2.scans,0);assert.equal(stored.size,1);
    const denied=await worker.fetch(new Request('https://api.example.com/api/leaderboard',{headers:{Origin:'https://evil.example'}}),{...env,ALLOWED_ORIGIN:'https://agentorchard.pages.dev'});
    assert.equal(denied.status,403);
    // Manual admin sync from PowerShell/curl has no browser Origin header.
    const adminDenied=await worker.fetch(new Request('https://api.example.com/api/admin/sync',{method:'POST'}),{...env,SYNC_TOKEN:'this_is_a_very_long_private_test_token_123',ALLOWED_ORIGIN:'https://agentorchard.pages.dev'});
    assert.equal(adminDenied.status,401);
    const adminAllowed=await worker.fetch(new Request('https://api.example.com/api/admin/sync',{method:'POST',headers:{Authorization:'Bearer this_is_a_very_long_private_test_token_123'}}),{...env,SYNC_TOKEN:'this_is_a_very_long_private_test_token_123',ALLOWED_ORIGIN:'https://agentorchard.pages.dev'});
    assert.equal(adminAllowed.status,200);
  }finally{globalThis.fetch=original;}
});
