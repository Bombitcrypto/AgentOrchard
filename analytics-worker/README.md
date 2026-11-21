# Analytics Worker v2.3 (Agent ID on-chain name resolution)

Cloudflare Worker `src.js` indexes game events from BNB Mainnet into D1 and resolves `.ai` Agent ID names from the official registry. All lookups are read-only. Public endpoints require `Origin: https://agentorchard.pages.dev` except `/api/health`; this is a CORS/origin policy, not wallet authentication.

## Before deployment

1. Set up Cloudflare Worker and D1 using a private, git-ignored `wrangler.toml`, based on `wrangler.toml.example`.
2. Set accurate `START_BLOCK` from the contract's actual deployment receipt. Never guess block numbers.
3. Configure `RPC_URL` (BNB Mainnet endpoint supporting `eth_getLogs`), `VISITOR_SALT` and `SYNC_TOKEN` via `wrangler secret put NAME`.
4. After reviewing code and preserving your current production configuration, run `npx.cmd wrangler deploy` on Windows or `npx wrangler deploy` elsewhere.
5. Verify `/api/health` and `GET /api/agent-name?address=...` with correct Origin header, and verify leaderboard/indexer progress.
6. Never deploy new Solidity contract simply to upgrade this Worker.

The D1 schema is provided as `schema.sql` for **first-time** initialization only. Re-running migrations against production must be reviewed beforehand.
