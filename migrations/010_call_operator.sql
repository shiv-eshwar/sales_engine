ALTER TABLE call_sessions ADD COLUMN operator_user_id TEXT;
ALTER TABLE call_sessions ADD COLUMN operator_email TEXT;

CREATE INDEX IF NOT EXISTS idx_call_sessions_lead_created
  ON call_sessions(lead_id, created_at);
