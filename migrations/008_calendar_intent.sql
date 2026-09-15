ALTER TABLE calendar_proposals ADD COLUMN intent TEXT NOT NULL DEFAULT 'meeting';
ALTER TABLE calendar_proposals ADD COLUMN linked_proposal_id TEXT;
