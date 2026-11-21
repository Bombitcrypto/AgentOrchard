/**
 * Agent Orchard public analytics API and BNB Mainnet event indexer.
 * Hosted on Cloudflare Worker + D1; NEVER signs or sends transactions.
 * JSON-RPC read methods: eth_chainId, eth_blockNumber, eth_getLogs.
 */
const ORCHARD = '0x185e900b5986362f8d8eac4c4294aba11d62a997';
const TOPICS = Object.freeze({
  '0x41b3438661f26a3a01f996c4f1e64c88e03fa6f288e63d9d9130507da11f682e': 'checkin',
  '0xfd9ee941c3e90ea0311ceac27dbf6480b6a7c67192df2eb53bb663e043d080c3': 'plant',
  '0x60873ba626bee4068c437d7c94a19a23c9c1a5337f6ce55a6a7692cc8c5b3bdc': 'tend',
  '0x003d202daac80d3a11461291e5ca580e833255cfccff45fcf3ff510715dfe975': 'harvest',
  '0x6e79522d33e3590933a0f11623ebc984abab3d341dd3e9b88e4e2503b15d9ab6': 'badge'
});
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
/**
 * Binance Agent ID on-chain resolver. No BscScan scraping, external name API,
 * third-party sign-in, or user-supplied mapping.
 *
 * Registry: SPACE ID Agent ID on BSC Mainnet (56).
 * handleOf(address) -> raw handle (WITHOUT .ai)
 * ownerOfHandle(string) -> address (expects raw handle WITHOUT .ai)
 * A name is displayed ONLY after both calls agree on the wallet.
 * All reads use existing secret RPC_URL; no gas and no transactions.
 */
const AGENT_ID_REGISTRY = '0x60b9262456de011f7d15a54cdd8c48baaa8b022f';
const HANDLE_OF_SELECTOR = '0xc50a1514'; // keccak256('handleOf(address)')[0:4]
const OWNER_OF_HANDLE_SELECTOR = '0x1da94fb4'; // keccak256('ownerOfHandle(string)')[0:4]
const AGENT_NAME = /^[a-z0-9][a-z0-9-]{1,30}\.ai$/i;
const RAW_HANDLE = /^[a-z0-9][a-z0-9-]{1,30}$/i;
const NAME_CACHE_SECONDS = 900;
const NULL_NAME_CACHE_SECONDS = 90;

function abiWord(value) { return BigInt(value).toString(16).padStart(64, '0'); }
function encodeHandleOf(wallet) {
  if (!ADDRESS.test(wallet)) throw Error('Invalid wallet address');
  return HANDLE_OF_SELECTOR + wallet.slice(2).toLowerCase().padStart(64, '0');
}
function encodeOwnerOfHandle(handle) {
  if (typeof handle !== 'string' || !RAW_HANDLE.test(handle)) throw Error('Invalid Agent ID handle');
  const bytes = new TextEncoder().encode(handle);
  const body = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
  return OWNER_OF_HANDLE_SELECTOR + abiWord(32) + abiWord(bytes.length) + body.padEnd(Math.ceil(bytes.length / 32) * 64, '0');
}
function decodeAbiString(value) {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(value)) return null;
  const data = value.slice(2);
  if (data.length < 128) return null;
  try {
    const offset = BigInt('0x' + data.slice(0, 64));
    if (offset < 32n || offset % 32n !== 0n || offset > BigInt(data.length / 2 - 32)) return null;
    const pos = Number(offset) * 2;
    const size = BigInt('0x' + data.slice(pos, pos + 64));
    if (size > 128n || BigInt(data.length / 2) < offset + 32n + size) return null;
    const hex = data.slice(pos + 64, pos + 64 + Number(size) * 2);
    const raw = Uint8Array.from(hex.match(/../g) || [], chunk => parseInt(chunk, 16));
    return new TextDecoder('utf-8', {fatal: true}).decode(raw);
  } catch (_) { return null; }
}
function decodeAbiAddress(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null;
  const word = value.slice(2);
  if (!/^0{24}$/i.test(word.slice(0, 24))) return null;
  const address = '0x' + word.slice(24).toLowerCase();
  return /^0x0{40}$/.test(address) ? null : address;
}
async function callAgentId(env, data) {
  return rpc(env, 'eth_call', [{to: AGENT_ID_REGISTRY, data}, 'latest']);
}
async function handleForWallet(wallet, env) {
  if (!ADDRESS.test(wallet)) return null;
  try {
    const result = await callAgentId(env, encodeHandleOf(wallet));
    const handle = decodeAbiString(result);
    return handle && RAW_HANDLE.test(handle) ? handle : null;
  } catch (err) {
    console.warn('Agent ID handle lookup failed:', String(err.message || err).slice(0, 120));
    return null;
  }
}
async function ownerForHandle(handle, env) {
  if (!RAW_HANDLE.test(handle || '')) return null;
  try {
    return decodeAbiAddress(await callAgentId(env, encodeOwnerOfHandle(handle)));
  } catch (err) {
    console.warn('Agent ID owner lookup failed:', String(err.message || err).slice(0, 120));
    return null;
  }
}
async function resolveAgentName(wallet, env = {}) {
  if (!ADDRESS.test(wallet)) return null;
  const normalized = wallet.toLowerCase();
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  // v3 avoids stale null responses stored by the former SPACE ID reverse resolver.
  const key = new Request('https://agentorchard-name-cache.invalid/v3/' + normalized);
  if (cache) {
    try {
      const prior = await cache.match(key);
      if (prior) {
        const saved = await prior.json();
        return AGENT_NAME.test(saved.name || '') ? saved.name : null;
      }
    } catch (_) {}
  }
  const handle = await handleForWallet(normalized, env);
  let name = null;
  if (handle) {
    const owner = await ownerForHandle(handle, env);
    if (owner && owner.toLowerCase() === normalized) name = handle + '.ai';
  }
  if (cache) {
    try {
      await cache.put(key, new Response(JSON.stringify({name}), {
        headers: {'Content-Type':'application/json', 'Cache-Control': 'public,max-age=' + (name ? NAME_CACHE_SECONDS : NULL_NAME_CACHE_SECONDS)}
      }));
    } catch (_) {}
  }
  return name;
}
async function forwardAgentName(name, env = {}) {
  if (typeof name !== 'string' || !AGENT_NAME.test(name)) return null;
  const handle = name.slice(0, -3);
  // Registry handles may be lowercase even if the user types SignalX.ai.
  const candidates = [...new Set([handle, handle.toLowerCase()])];
  for (const candidate of candidates) {
    const owner = await ownerForHandle(candidate, env);
    if (!owner) continue;
    const reverse = await handleForWallet(owner, env);
    if (reverse && reverse.toLowerCase() === candidate.toLowerCase()) return owner;
  }
  return null;
}
async function withAgentNames(rows, env) {
  // Keep RPC concurrency bounded; 2 eth_call requests per verified name.
  const list = new Array(rows.length);
  let next = 0;
  const count = Math.min(4, rows.length);
  await Promise.all(Array.from({length:count}, async () => {
    while (next < rows.length) {
      const index = next++;
      list[index] = {...rows[index], agentIdName:await resolveAgentName(rows[index].wallet, env)};
    }
  }));
  return list;
}

const HEX = /^0x[0-9a-fA-F]+$/;
const SORT = {xp:'xp',checkins:'checkins',plants:'plants',tends:'tends',harvests:'harvests',badges:'badges',bestStreak:'bestStreak'};
const rollup = `SELECT wallet,
 SUM(CASE WHEN action='checkin' THEN 1 ELSE 0 END) AS checkins,
 SUM(CASE WHEN action='plant' THEN 1 ELSE 0 END) AS plants,
 SUM(CASE WHEN action='tend' THEN 1 ELSE 0 END) AS tends,
 SUM(CASE WHEN action='harvest' THEN 1 ELSE 0 END) AS harvests,
 SUM(CASE WHEN action='badge' THEN 1 ELSE 0 END) AS badges,
 SUM(xp_delta) AS xp, MAX(streak) AS bestStreak, MAX(block_number) AS lastBlock
 FROM chain_events`;
function result(obj, status=200, cors={}, cache='no-store') {
  return new Response(JSON.stringify(obj), {status,headers:{'Content-Type':'application/json;charset=UTF-8','Cache-Control':cache,'X-Content-Type-Options':'nosniff',...cors}});
}
function corsHeaders(request, env) {
  const origin=request.headers.get('Origin') || '';
  const allowed=String(env.ALLOWED_ORIGIN||'').replace(/\/$/,'');
  return allowed && origin===allowed ? {'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Headers':'content-type,authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin'} : {};
}
function originAllowed(request,env) {
  return request.headers.get('Origin')===String(env.ALLOWED_ORIGIN||'').replace(/\/$/,'');
}
function dayUTC() { return new Date().toISOString().slice(0,10); }
function uint256(str) { if (!HEX.test(str||'')) throw Error('Malformed chain event'); return BigInt(str); }
function dataWord(data, index) {
  const word = (data||'').slice(2+index*64, 2+(index+1)*64);
  if (!/^[a-f0-9]{64}$/i.test(word)) throw Error('Malformed event data');
  return BigInt('0x'+word);
}
function asSafe(v) { if (v>BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Unsafe uint in log'); return Number(v); }
function decodeLog(log) {
  const action=TOPICS[(log.topics?.[0]||'').toLowerCase()];
  if (!action || !log.topics?.[1] || !/^0x[0-9a-f]{64}$/i.test(log.topics[1])) return null;
  const wallet='0x'+log.topics[1].slice(-40).toLowerCase();
  if (!ADDRESS.test(wallet)) return null;
  const block=asSafe(uint256(log.blockNumber));
  const logIndex=asSafe(uint256(log.logIndex));
  if (!/^0x[0-9a-f]{64}$/i.test(log.transactionHash||'')) throw Error('Malformed transaction hash');
  let xp=0, streak=0, utcDay=null;
  if (action==='checkin') {
    if (!log.topics?.[2]) throw Error('CheckIn day topic missing');
    utcDay=asSafe(uint256(log.topics[2]));
    streak=asSafe(dataWord(log.data,0)); xp=10;
  } else if (action==='plant') xp=15;
  else if (action==='tend') xp=20;
  else if (action==='harvest') xp=50;
  else if (action==='badge') {
    const tier=asSafe(dataWord(log.data,0));
    if (tier<1||tier>3) throw Error('Unknown badge tier');
    xp= tier===1 ? 50 : tier===2 ? 120 : 300;
  }
  return {id:`${log.transactionHash.toLowerCase()}:${logIndex}`,block,wallet,action,xp,streak,utcDay,txHash:log.transactionHash.toLowerCase()};
}
async function rpc(env,method,params=[]) {
  const url=env.RPC_URL;
  if (!url || !/^https:\/\//.test(url)) throw Error('Set secret RPC_URL to a BSC RPC with eth_getLogs support');
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(19000)});
  if (!res.ok) throw Error(`RPC ${method} returned HTTP ${res.status}`);
  const json=await res.json();
  if (json.error) throw Error(`RPC ${method}: ${String(json.error.message||json.error.code).slice(0,160)}`);
  if (json.result===undefined) throw Error(`Missing RPC ${method} result`);
  return json.result;
}
async function indexEvents(env) {
  if (!env.DB) throw Error('D1 database binding DB missing');
  if (String(env.ORCHARD_CONTRACT||'').toLowerCase()!==ORCHARD) throw Error('Incorrect orchard contract');
  const start=Number(env.START_BLOCK);
  if (!Number.isSafeInteger(start) || start<=0) throw Error('Set actual deployment START_BLOCK before sync');
  const chain=await rpc(env,'eth_chainId');
  if (Number(BigInt(chain))!==56) throw Error('RPC is not BSC Mainnet (56)');
  const head=Math.max(0,Number(BigInt(await rpc(env,'eth_blockNumber')))-15);
  const existing=await env.DB.prepare("SELECT value FROM index_meta WHERE key='cursor'").first();
  let cursor=existing ? Number(existing.value) : start-1;
  if (cursor<start-1) cursor=start-1;
  const step=Math.min(2000,Math.max(100,Number(env.BLOCK_STEP)||1000));
  const chunks=Math.min(20,Math.max(1,Number(env.MAX_CHUNKS)||12));
  let scans=0,insertAttempted=0;
  while (cursor<head && scans<chunks) {
    const from=cursor+1, to=Math.min(head,cursor+step);
    const logs=await rpc(env,'eth_getLogs',[{address:env.ORCHARD_CONTRACT,fromBlock:'0x'+from.toString(16),toBlock:'0x'+to.toString(16),topics:[Object.keys(TOPICS)]}]);
    if (!Array.isArray(logs)) throw Error('RPC logs response is not an array');
    const parsed=logs.map(decodeLog).filter(Boolean);
    for (let i=0;i<parsed.length;i+=75) {
      const queries=parsed.slice(i,i+75).map(log=>env.DB.prepare(
        'INSERT OR IGNORE INTO chain_events (id,block_number,wallet,action,xp_delta,streak,utc_day,tx_hash) VALUES (?,?,?,?,?,?,?,?)')
        .bind(log.id,log.block,log.wallet,log.action,log.xp,log.streak,log.utcDay,log.txHash));
      await env.DB.batch(queries);
    }
    await env.DB.prepare("INSERT INTO index_meta(key,value) VALUES('cursor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(to)).run();
    cursor=to;scans++;insertAttempted+=parsed.length;
  }
  const info={cursor,head,scans,indexedEvents:insertAttempted,complete:cursor>=head,time:new Date().toISOString()};
  await env.DB.prepare("INSERT INTO index_meta(key,value) VALUES('status',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(info)).run();
  return info;
}
async function indexStatus(env) {
  const r=await env.DB.prepare("SELECT value FROM index_meta WHERE key='status'").first();
  const start=Number(env.START_BLOCK||0);
  return {startBlock:start||null,...(r?JSON.parse(r.value):{cursor:null,head:null,complete:false,time:null}),source:'BNB Mainnet contract events · indexed through finalized blocks'};
}
async function leaderboard(env,sort='xp',limit=20) {
  const key=SORT[sort]||'xp';
  // Sort key is only ever selected from the internal whitelist.
  const query=`SELECT * FROM (${rollup} GROUP BY wallet) ORDER BY ${key} DESC, checkins DESC, wallet ASC LIMIT ?`;
  const r=await env.DB.prepare(query).bind(Math.min(50,Math.max(1,limit))).all();
  return r.results||[];
}
async function walletStats(env,address) {
  if (!ADDRESS.test(address)) return null;
  return env.DB.prepare(`SELECT * FROM (${rollup} WHERE wallet=? GROUP BY wallet)`).bind(address.toLowerCase()).first();
}
async function summary(env) {
  const [events,visits,progress]=await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS transactions,COUNT(DISTINCT wallet) AS wallets,
      SUM(CASE WHEN action='checkin' THEN 1 ELSE 0 END) AS checkins,
      SUM(CASE WHEN action='plant' THEN 1 ELSE 0 END) AS plants,
      SUM(CASE WHEN action='tend' THEN 1 ELSE 0 END) AS tends,
      SUM(CASE WHEN action='harvest' THEN 1 ELSE 0 END) AS harvests,
      SUM(CASE WHEN action='badge' THEN 1 ELSE 0 END) AS badges
      FROM chain_events`).first(),
    env.DB.prepare('SELECT utc_day, views FROM daily_views WHERE utc_day >= ? ORDER BY utc_day ASC').bind(new Date(Date.now()-6*86400000).toISOString().slice(0,10)).all(),
    indexStatus(env)
  ]);
  const session=await env.DB.prepare('SELECT COUNT(*) as sessions FROM visits WHERE utc_day=?').bind(dayUTC()).first();
  const allDays=new Map((visits.results||[]).map(x=>[x.utc_day,Number(x.views)]));
  const daily=Array.from({length:7},(_,i)=>{const day=new Date(Date.now()-(6-i)*86400000).toISOString().slice(0,10);return {date:day,pageviews:allDays.get(day)||0};});
  const today=daily[6].pageviews;
  return {onchain:Object.fromEntries(Object.entries(events||{}).map(([k,v])=>[k,Number(v||0)])),website:{todayPageviews:today,todaySessions:Number(session?.sessions||0),last7Days:daily,units:'page views and approximate browser sessions, not unique people'},indexer:progress};
}
async function sha256(text) {
  const bytes=new TextEncoder().encode(text);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
async function recordVisit(request,env) {
  if (!env.VISITOR_SALT || String(env.VISITOR_SALT).length<20) throw Error('VISITOR_SALT secret required');
  if (Number(request.headers.get('Content-Length')||0)>500) throw Error('Payload too large');
  const payload=await request.json();
  if (!payload || typeof payload.session!=='string'|| !/^[a-f0-9-]{20,60}$/i.test(payload.session)) throw Error('Invalid session ID');
  const day=dayUTC(), hash=await sha256(`${env.VISITOR_SALT}:${day}:${payload.session}`);
  const prior=await env.DB.prepare('SELECT views FROM visits WHERE utc_day=? AND session_hash=?').bind(day,hash).first();
  if (prior && prior.views>=20) return {recorded:false,reason:'per-session daily limit'};
  if (!prior) await env.DB.prepare('INSERT OR IGNORE INTO visits(utc_day,session_hash,views) VALUES(?,?,0)').bind(day,hash).run();
  const update=await env.DB.prepare('UPDATE visits SET views=views+1 WHERE utc_day=? AND session_hash=? AND views<20').bind(day,hash).run();
  if (update.meta?.changes!==1) return {recorded:false,reason:'per-session daily limit'};
  await env.DB.prepare('INSERT INTO daily_views(utc_day,views) VALUES(?,1) ON CONFLICT(utc_day) DO UPDATE SET views=views+1').bind(day).run();
  return {recorded:true};
}
export default {
  async fetch(request,env) {
    const cors=corsHeaders(request,env);
    const url=new URL(request.url), path=url.pathname;
    if (request.method==='OPTIONS') return new Response(null,{status:originAllowed(request,env)?204:403,headers:cors});
    if (!env.DB) return result({error:'D1 database is not configured'},503,cors);
    try {
      if (path==='/api/health' && request.method==='GET') return result({status:'ok',contract:ORCHARD,chainId:56,indexer:await indexStatus(env)},200,cors);
      // Server-to-server admin requests have no Origin: require bearer secret.
      if (path==='/api/admin/sync' && request.method==='POST') {
        const token=String(env.SYNC_TOKEN||'');
        if (token.length<24 || request.headers.get('Authorization')!==`Bearer ${token}`) return result({error:'Not authorized'},401,cors);
        return result(await indexEvents(env),200,cors);
      }
      if (!originAllowed(request,env)) return result({error:'Origin is not authorized'},403,cors);
      if (path==='/api/stats' && request.method==='GET') return result(await summary(env),200,cors,'public, max-age=30');
      if (path==='/api/leaderboard' && request.method==='GET') {
        const sort=url.searchParams.get('sort')||'xp';
        const rows=await leaderboard(env,sort,Number(url.searchParams.get('limit')||20));
        return result({rows:await withAgentNames(rows,env),indexer:await indexStatus(env),sort:SORT[sort]||'xp'},200,cors,'public, max-age=30');
      }
      if(path==='/api/agent-name' && request.method==='GET') {
        const wallet=url.searchParams.get('address')||'';
        if(!ADDRESS.test(wallet)) return result({error:'Invalid wallet address'},400,cors);
        const agentIdName=await resolveAgentName(wallet,env);
        return result({wallet:wallet.toLowerCase(),agentIdName,verified:Boolean(agentIdName),source:'BNB Mainnet Agent ID registry: handleOf + ownerOfHandle'},200,cors,'public,max-age=30');
      }
      if (path==='/api/wallet' && request.method==='GET') {
        let address=url.searchParams.get('address')||'';
        if(!ADDRESS.test(address) && AGENT_NAME.test(address)) address=await forwardAgentName(address,env)||'';
        if (!ADDRESS.test(address)) return result({error:'Invalid wallet address or unresolvable .ai Agent ID'},400,cors);
        const row=await walletStats(env,address);
        return result({wallet:row?{...row,agentIdName:await resolveAgentName(address,env)}:null,indexer:await indexStatus(env)},200,cors);
      }
      if (path==='/api/visit' && request.method==='POST') return result(await recordVisit(request,env),200,cors);
      return result({error:'Not found'},404,cors);
    } catch (error) {
      console.error('AgentOrchard analytics:',error.message);
      return result({error:String(error.message).slice(0,160)},500,cors);
    }
  },
  async scheduled(event,env,ctx) {
    ctx.waitUntil(indexEvents(env).catch(async error=>{
      console.error('AgentOrchard indexer:',error);
      if (env.DB) await env.DB.prepare("INSERT INTO index_meta(key,value) VALUES('error',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(error.message.slice(0,300)).run();
    }));
  }
};
export {decodeLog, indexEvents,resolveAgentName,forwardAgentName,withAgentNames};
