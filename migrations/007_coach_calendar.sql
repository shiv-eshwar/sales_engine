CREATE TABLE IF NOT EXISTS coach_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  based_on_sequence INTEGER,
  calendar_proposal_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES call_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_coach_messages_session
  ON coach_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS calendar_oauth (
  id TEXT PRIMARY KEY,
  email TEXT,
  encrypted_refresh_token TEXT NOT NULL,
  encrypted_access_token TEXT,
  access_expires_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_proposals (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  start_iso TEXT NOT NULL,
  end_iso TEXT NOT NULL,
  timezone TEXT NOT NULL,
  attendees_json TEXT NOT NULL,
  meet INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  google_event_id TEXT,
  html_link TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_calendar_proposals_session
  ON calendar_proposals(session_id, created_at);
