# Optional read-only Cloudflare Worker RPC proxy

Use this only if your chosen public BSC RPC endpoint blocks browser CORS.

1. Create a **new Cloudflare Worker** and paste `worker.js` as module worker (or use Wrangler).
2. Set environment variables `ALLOWED_ORIGIN=https://YOUR-ORCHARD.pages.dev`, `ORCHARD_CONTRACT=0xYOUR_NEW_ORCHARD_CONTRACT`, and `RPC_UPSTREAM=https://YOUR_BSC_RPC`.
3. Deploy the Worker. Change `site/config.js` `RPC` to your deployed worker's `https://...workers.dev` address.
4. Add Cloudflare WAF rate limiting. The Worker is **read-only**, but still creates load at the upstream RPC provider. Never put API secrets in frontend.
5. Keep `ALLOWED_ORIGIN` exactly equal to the site's origin, with no trailing `/`. CORS limits browser clients, but is NOT security against server-to-server requests.

The worker does not authenticate wallets or relay transactions. All transactions originate from the user's official wallet and consume BNB gas.
