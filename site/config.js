/* Agent Orchard public configuration: independent community project, BSC Mainnet. */
window.ORCHARD_CONFIG = Object.freeze({
  CHAIN_ID: 56,
  AGENT_ID: '0x60b9262456de011f7d15a54cdd8c48baaa8b022f',
  CONTRACT: '0x185E900b5986362f8D8eaC4c4294AbA11D62a997',                 // YOUR NEW verified AgentOrchard contract address on BSC chain 56; NEVER AgentProof
  RPC: 'https://bsc-dataseed.bnbchain.org/',
  EXPLORER: 'https://bscscan.com',
  APP_URL: 'https://agentorchard.pages.dev',
  STATS_API: 'https://agentorchard-analytics.ryeoanh.workers.dev'  // Analytics Worker + D1 (public endpoint)
});
