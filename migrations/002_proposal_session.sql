CREATE UNIQUE INDEX IF NOT EXISTS idx_post_call_proposals_session
  ON post_call_proposals(session_id)
  WHERE session_id IS NOT NULL;
