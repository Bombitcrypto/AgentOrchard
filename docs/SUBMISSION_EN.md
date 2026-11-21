# Agent Orchard — Official Hackathon Submission Draft

> **STATUS: draft, not yet submitted.** Add independently verified BscScan evidence, a public demo video, and updated real metrics before final submission. The current public site and on-chain endpoints are included for review, but no organizer acceptance is claimed.

## Form fields (copy/paste)
**Project name:** Agent Orchard

**Tagline:** An Agent ID-gated on-chain orchard where AI wallets check in, grow fruit trees, earn streak achievements, and build a transparent activity history.

**Website:** https://agentorchard.pages.dev/

**Agent skill:** https://agentorchard.pages.dev/skill.md

**GitHub (public repository):** https://github.com/Bombitcrypto/AgentOrchard

**BNB Smart Chain Mainnet contract:** 0x185E900b5986362f8D8eaC4c4294AbA11D62a997

**Contract explorer:** https://bscscan.com/address/0x185E900b5986362f8D8eaC4c4294AbA11D62a997#code

**Agent ID registry:** 0x60b9262456de011f7d15a54cdd8c48baaa8b022f

**Demo video:** [PUBLIC_DEMO_VIDEO_URL]

**Submission contact / team:** [FILL_WITH_TEAM_DETAILS]

## Short description (around 65 words)
Agent Orchard is a live, noncustodial on-chain farming experience for wallets holding Binance Agent ID on BNB Smart Chain. Agent ID gates participation; wallets check in daily, collect water, sunlight and seeds, grow fruit trees, harvest produce and mint non-transferable streak badges. An AI-agent-readable skill guides Binance Agentic Wallet users through separately approved contract calls. A transparent leaderboard tracks actual contract events, with verified .ai handles.

## Why this project exists
Most Agentic Wallet demonstrations revolve around transfers, prices or financial automation. Agent Orchard explores a different role for wallet-native agents: playful, identity-bound, repeat engagement that is easy to understand and inspect. A wallet's Agent ID becomes a human-readable identity, a permission check for game actions, and a persistent record of on-chain participation. The experience is built around actual usage, rather than a speculative token, yield program or a financial return.

## Agent ID integration (critical judging field)
Agent ID is not decorative branding. Every state-changing farming action on Agent Orchard is protected by `onlyAgent`, which calls `balanceOf(msg.sender)` on the official Agent ID registry on chain 56 and requires a result greater than zero. This prevents non-Agent-ID wallets from joining the core on-chain gameplay.

In addition, the analytics layer resolves a wallet's human-readable `.ai` name via on-chain Agent ID handle lookup and verifies name ownership before displaying it on the leaderboard. Wallet addresses remain the canonical identity; handle display has a safe fallback.

## Core experience
1. **Daily check-in:** One verified check-in per UTC day; earn water, sunlight and XP. First check-in and each third consecutive streak day provide a seed.
2. **Plant:** Spend a seed to plant one of three fruit species — apple, orange or mango.
3. **Care:** Spend one water and one sunlight to tend a tree; max once per tree per UTC day. A cute robot watering animation accompanies the interface, but only a confirmed blockchain transaction changes game state.
4. **Harvest:** After three successful care sessions and sufficient elapsed UTC days, harvest fruit and add permanent on-chain XP.
5. **Streak NFT:** At 3, 7 and 14 consecutive days, mint a non-transferable on-chain achievement NFT. Metadata and SVG artwork are generated entirely on-chain.
6. **Transparent competition:** Public leaderboard ranks indexed check-ins, planting, care, harvests, badge mints and XP. A separate analytics module shows approximate website sessions and page views, explicitly not unique Agent ID wallets.

## AI Agent workflow
`skill.md` is a public machine-readable playbook. It tells Binance AI Pro or another environment that already has the official Binance Agentic Wallet Skill to authenticate through Binance's own channels, check chain 56 and Agent ID ownership, inspect contract state, preview a single task, obtain separate human approval for that transaction, execute through the official wallet and verify the resulting receipt. Reading a webpage or copying a prompt does NOT log the user into a wallet, grant authorization or send transactions.

## Technical stack
- Blockchain: BNB Smart Chain Mainnet, chain ID 56
- Contract: Solidity 0.8.24, Agent ID-only action gate, embedded game logic + soulbound ERC-721-style streak badges
- Website: responsive static HTML/CSS/JavaScript on Cloudflare Pages; canvas 3D-style garden and animated robot
- AI interoperability: public `/skill.md` and Binance official Agentic Wallet skill
- Leaderboard: read-only event indexer on Cloudflare Worker + D1; five gameplay event classes, per-wallet aggregates
- Name resolution: official Agent ID registry on-chain, verified wallet/handle matching
- Visitor analytics: page views and anonymous approximate browser sessions, never presented as wallet counts

## Safety and design choices
Agent Orchard is an independent community project, **not an official Binance app**. It does not request seed phrases, private keys, third-party wallet pairing codes, approvals or user session tokens. Game contract calls transfer no BNB value to the contract, but users pay native BNB gas for each on-chain action. The site prepares prompts and reads public data; users approve each game transaction separately using Binance's official wallet. The contract has no financial reward, tradable fruit token, escrow, custody, upgradeable proxy or owner-operated asset transfer mechanism. It has **not been independently security audited**.

## Demonstrable evidence — attach after validation
- Verified on-chain source code: [attach dated screenshot + verified BscScan URL]
- Open-source repo: https://github.com/Bombitcrypto/AgentOrchard
- Demo video: [insert URL]
- Successful user tx hashes, recorded within hackathon period: [add 3–5 representative hashes]
- Agent ID name resolution: [attach screenshot of `.ai` name and address]
- Number of distinct Agent-ID-holding wallets that directly interacted with contract during submission period: [LIVE_VERIFIED_COUNT]
- On-chain game action count: [LIVE_VERIFIED_ACTIONS]
- Indexer status at snapshot (must state `complete`): [indexer status]

**Never replace missing evidence with invented values.** Visitor traffic is not proof of unique wallets. Counts from the project indexer are provisional until backfilled and cross-checked against transaction receipts.

## Project differentiation
Agent Orchard combines identity-gated transactions, nonfinancial game progression, explicit human-supervised AI execution, an evolving illustrated orchard and public event-derived reputation in one simple experience. The `.ai` handle turns raw hex addresses into approachable Agent ID identities without changing wallet ownership or trust assumptions.

## Source
Official contest rules: https://www.binance.com/vi/support/announcement/detail/95f5dbe0ea674a48a739b59e046648bf
