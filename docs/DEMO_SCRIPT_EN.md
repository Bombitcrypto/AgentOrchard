# Agent Orchard — 3-minute Hackathon Demo Script

> Record from the **real deployed site and explorer**. Do not use old preview illustrations as evidence of current balances, successful transactions, or live contract verification. If the full three-day lifecycle has not been recorded, label it honestly as a product walkthrough / historical event replay.

## 00:00–00:20 — The idea
**On-screen:** agentorchard.pages.dev hero + 3D orchard and robot.
**Narration:** "Agent Orchard turns an Agent ID wallet into a living on-chain garden. Every day, an agent can check in, grow a tree and build a visible history of participation on BNB Smart Chain. No farming token, no yield promises — just identity, consistency and a playful interface."

## 00:20–00:45 — Agent ID identity gate
**On-screen:** verified BscScan contract and `agentId.balanceOf(msg.sender)` gate; show wallet name `SignalX.ai` and address together.
**Narration:** "Only wallets holding the official Binance Agent ID can invoke the game's state-changing actions. Human-readable `.ai` names come directly from on-chain name resolution, and the underlying wallet stays verifiable."

## 00:45–01:10 — Skill, wallet safety, check-in
**On-screen:** `/skill.md`, Binance official AI Pro and a real confirmed CheckIn tx.
**Narration:** "The public skill explains the available actions to Binance AI Pro. Authentication happens only in Binance. Each transaction is previewed, separately approved and paid for with BNB gas. The website never signs on the user's behalf."

## 01:10–01:45 — Plant and water a tree
**On-screen:** show one existing TreePlanted event and an actual tree ID. Trigger robot watering animation and show real TreeTended receipt if available.
**Narration:** "A daily check-in gives water and sunlight. Seeds let the owner plant an apple, orange or mango tree. The robot's watering animation is visual feedback; the on-chain care counter updates only after transaction confirmation."

## 01:45–02:10 — Harvest and NFT streak (proof required)
**On-screen:** confirmed harvest receipt, then NFT tokenURI or token ownership. If not yet available, show UI as "upcoming milestone" with no claim that these actions have already happened.
**Narration:** "Three care sessions across separate UTC days unlock a harvest. Streaks of three, seven and fourteen days unlock non-transferable achievement NFTs with on-chain artwork."

## 02:10–02:40 — Leaderboard and data integrity
**On-screen:** current leaderboard, stats API health JSON, `.ai` name; show indexer complete status. Prefer exact block/time and on-chain event counts.
**Narration:** "The leaderboard is built from confirmed BNB Chain events. It ranks wallets by real check-ins, planting, tending, harvests and XP. Website page views are reported separately and never counted as unique Agent IDs."

## 02:40–03:00 — Call to action
**On-screen:** website URL, skill URL, BscScan verified address and public GitHub URL.
**Narration:** "Agent Orchard is live on BNB Mainnet as an independent, noncustodial community project. Bring your own Agent ID, complete a small daily task and watch your on-chain garden grow."

## Mandatory evidence overlays (add real, not fabricated data)
- Contract `0x185E900b5986362f8D8eaC4c4294AbA11D62a997` and chain 56.
- Transaction hashes for **confirmed** CheckIn / TreePlanted / TreeTended / Harvest / BadgeMinted actions, when available.
- Timestamp/UTC-day difference for multi-day events.
- Verified BscScan source, not only contract address.
- Public repository and `skill.md` links.
- Actual distinct Agent ID-holding interacting wallets within submission period and indexer backfill timestamp.
