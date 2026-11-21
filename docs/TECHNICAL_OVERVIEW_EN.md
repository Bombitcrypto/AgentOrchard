# Agent Orchard — Architecture, Contract Rules & Verification

## Architecture
```
Human user ── prompts ──> Binance AI Pro / official Agentic Wallet Skill
      │                            │
      │                 Binance official authentication
      │                 preview -> separate user approval -> execute
      │                            │
      │                            v
      ├─ public address -> BNB Smart Chain (56): AgentOrchard
      │                      │    └── Agent ID registry balanceOf(msg.sender)>0
      │                      ├── CheckIn / TreePlanted / TreeTended
      │                      └── FruitHarvested / BadgeMinted events
      v                                      │
Cloudflare Pages                        Cloudflare Worker + D1
      └───────── reads public data <─────────┘
                      └── leaderboard + names + website analytics
```

## Exact addresses
- Orchard: `0x185E900b5986362f8D8eaC4c4294AbA11D62a997`
- Agent ID registry: `0x60b9262456de011f7d15a54cdd8c48baaa8b022f`
- Chain: 56 / BNB Mainnet
- Official BscScan contract: https://bscscan.com/address/0x185E900b5986362f8D8eaC4c4294AbA11D62a997#code
- Analytics health: https://agentorchard-analytics.ryeoanh.workers.dev/api/health

## Functions: from reviewed project Solidity source (confirm against verified deployment)
| Function | Input | Requirements | State changes |
| --- | --- | --- | --- |
| `checkIn()` | none | Has Agent ID, not already checked in during current UTC day | +10 XP, +1 water, +1 sunlight, +1 seed on first / every third consecutive day, streak |
| `plant(uint8 species)` | 0 apple, 1 orange, 2 mango | Has Agent ID, at least 1 check-in, seed ≥1, under 100 trees | -1 seed, +15 XP, new TreePlanted event |
| `tend(uint256 treeId)` | owned tree ID | Has Agent ID, tree active, care < 3, not tended same day, water/sunlight ≥1 | -1 water, -1 sunlight, +20 XP, care +1 |
| `harvest(uint256 treeId)` | owned tree ID | Has Agent ID, care ≥3, ≥2 UTC days after planting, not harvested | +3 species fruit, +50 XP, harvest event |
| `mintBadge(uint8 tier)` | tiers 1/2/3 | Has Agent ID, active streak ≥3/7/14, tier not already minted | soulbound NFT, +50/120/300 XP |

All state-changing game functions use `onlyAgent` and revert for a wallet lacking the official Agent ID. There is no purchase price or payable value, but each successful or failed transaction still uses network gas.

## Five events indexed for leaderboard
- `CheckIn(address,uint256,uint32,uint32,uint32,uint32)`
- `TreePlanted(address,uint256,uint8)`
- `TreeTended(address,uint256,uint8)`
- `FruitHarvested(address,uint256,uint8,uint32)`
- `BadgeMinted(address,uint256,uint8)`

Rollup metrics: events grouped by wallet, checkins/plants/tends/harvests/badges; XP from known contract reward rules. Event dedupe should use transaction hash and log index. Indexed event counts may be incomplete until the backfill reaches the relevant finalized chain head. Name lookup is read-only via the official Agent ID registry; it should not be equated with the BscScan visual UI.

## Trust boundaries
- Website never receives signing authority or Binance session credentials.
- A public wallet address is a lookup key, not proof of website authentication.
- Agentic-wallet prompt is **not** a transaction or user approval.
- Binances's official Agentic Wallet is the signing environment. Preview must precede a separately authorized transaction.
- Analytics Worker read-only RPC has no private key and cannot move funds.
- Public RPC endpoint can become rate-limited or lag; backfill correctness must be monitored.
- App is independently built and unaudited; do not imply official Binance endorsement.

## Risks / limitations to disclose
- Contract's `today()` is `block.timestamp / 86400`: streaks track UTC days, not local dates.
- Changes from website animation are visual only until a confirmed on-chain receipt.
- Game results are nonfinancial and fruits cannot be transferred as ERC-20 tokens.
- NFT badges are intentionally non-transferable, not marketplace collectibles.
- Leaderboard ranks wallets and can include multiple wallets controlled by a single person; never claim unique humans.
- Website traffic counts are approximate, not proof of Agent ID ownership.
- Remote RPC can require retries and indexer can lag; show `complete: false` when backfill is ongoing.
