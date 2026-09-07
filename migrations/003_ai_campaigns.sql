CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  brief_json TEXT NOT NULL,
  strategy_json TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE campaign_leads (
  campaign_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  assigned INTEGER NOT NULL CHECK (assigned IN (0, 1)),
  PRIMARY KEY (campaign_id, lead_id)
);

CREATE TABLE prospect_preparations (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  campaign_version INTEGER NOT NULL,
  lead_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  body_json TEXT NOT NULL
);

CREATE INDEX preparation_lookup ON prospect_preparations
  (campaign_id, campaign_version, lead_id, input_hash, generated_at DESC);
