CREATE TABLE IF NOT EXISTS call_sessions (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_version INTEGER NOT NULL,
  lead_snapshot_json TEXT NOT NULL,
  status TEXT NOT NULL,
  twilio_parent_sid TEXT UNIQUE,
  twilio_child_sid TEXT UNIQUE,
  recording_sid TEXT,
  started_at TEXT,
  connected_at TEXT,
  ended_at TEXT,
  transport_outcome TEXT,
  transcript_complete INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transcript_utterances (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  confidence REAL,
  sequence INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES call_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_transcript_utterances_session
  ON transcript_utterances(session_id, sequence);

CREATE TABLE IF NOT EXISTS coaching_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  based_on_sequence INTEGER NOT NULL,
  stage TEXT NOT NULL,
  cue_type TEXT NOT NULL,
  cue TEXT,
  reason TEXT,
  output_json TEXT NOT NULL,
  shown_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES call_sessions(id)
);

CREATE TABLE IF NOT EXISTS post_call_proposals (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  proposed_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  status TEXT NOT NULL,
  approved_json TEXT,
  sheet_write_attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  applied_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_post_call_proposals_status
  ON post_call_proposals(status);

CREATE TABLE IF NOT EXISTS webhook_events (
  idempotency_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  result TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
