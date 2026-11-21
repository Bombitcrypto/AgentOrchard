/** OPTIONAL Cloudflare Worker: read-only CORS proxy to BSC RPC.
 * Never implements eth_sendRawTransaction or manages keys/BNB.
 * Configure RPC_UPSTREAM + ALLOWED_ORIGIN in Worker environment settings.
 * Add a Cloudflare WAF rate-limit rule if used publicly.
 */
const ALLOWED = new Set([
  'eth_chainId', 'eth_getCode', 'eth_call', 'eth_gasPrice',
  'eth_estimateGas', 'eth_getTransactionByHash', 'eth_getTransactionReceipt'
]);
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const AGENT_ID = '0x60b9262456de011f7d15a54cdd8c48baaa8b022f';
const json = (value, status, headers) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }
});
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = env.ALLOWED_ORIGIN || '';
    const cors = allowedOrigin && origin === allowedOrigin ? {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin'
    } : {};
    if (request.method === 'OPTIONS') return new Response(null, { status: origin === allowedOrigin ? 204 : 403, headers: cors });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, cors);
    if (origin !== allowedOrigin || !allowedOrigin) return json({ error: 'Origin blocked' }, 403, cors);
    if (!env.ORCHARD_CONTRACT || !ADDRESS.test(env.ORCHARD_CONTRACT)) return json({ error: 'Server misconfigured' }, 503, cors);
    if (Number(request.headers.get('Content-Length') || 0) > 2000) return json({ error: 'Payload too large' }, 413, cors);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, cors); }
    if (Array.isArray(body) || !body || body.jsonrpc !== '2.0' || !ALLOWED.has(body.method)
      || !Array.isArray(body.params)) return json({ error: 'Unsupported RPC request' }, 400, cors);
    const method = body.method;
    const p = body.params;
    const orch = env.ORCHARD_CONTRACT.toLowerCase();
    const whitelisted = address => ADDRESS.test(address || '')
      && [orch, AGENT_ID].includes(address.toLowerCase());
    const valid = (method === 'eth_chainId' || method === 'eth_gasPrice') && p.length === 0
      || method === 'eth_getCode' && p.length === 2 && whitelisted(p[0]) && p[1] === 'latest'
      || method === 'eth_call' && p.length === 2 && p[1] === 'latest'
        && p[0] && whitelisted(p[0].to) && /^0x[0-9a-fA-F]{8,600}$/.test(p[0].data || '')
      || method === 'eth_estimateGas' && p.length === 1 && p[0]
        && ADDRESS.test(p[0].from || '') && (p[0].to || '').toLowerCase() === orch
        && /^0x[0-9a-fA-F]{8,600}$/.test(p[0].data || '') && p[0].value === '0x0'
      || (method === 'eth_getTransactionByHash' || method === 'eth_getTransactionReceipt') && p.length === 1 && HASH.test(p[0] || '');
    if (!valid) return json({ error: 'Blocked RPC params' }, 400, cors);
    try {
      const response = await fetch(env.RPC_UPSTREAM || 'https://bsc-dataseed.bnbchain.org', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: p }),
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) return json({ error: 'Upstream RPC unavailable' }, 502, cors);
      const upstream = await response.text();
      if (upstream.length > 300000) return json({ error: 'RPC reply too large' }, 502, cors);
      return new Response(upstream, { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors } });
    } catch {
      return json({ error: 'Upstream timeout/failure' }, 502, cors);
    }
  }
};
