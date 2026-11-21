-- Agent Orchard: non-custodial event index and approximate privacy-friendly site analytics.
-- No private keys, wallet sessions, IPs, or personal identity data are stored.
CREATE TABLE IF NOT EXISTS chain_events (
  id TEXT PRIMARY KEY,
  block_number INTEGER NOT NULL,
  wallet TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('checkin','plant','tend','harvest','badge')),
  xp_delta INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  utc_day INTEGER,
  tx_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_wallet ON chain_events(wallet);
CREATE INDEX IF NOT EXISTS idx_events_block ON chain_events(block_number);
CREATE INDEX IF NOT EXISTS idx_events_action ON chain_events(action);
CREATE TABLE IF NOT EXISTS index_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS visits (
  utc_day TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (utc_day, session_hash)
);
CREATE TABLE IF NOT EXISTS daily_views (
  utc_day TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0
);
