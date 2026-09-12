ALTER TABLE campaigns ADD COLUMN spreadsheet_id TEXT;
ALTER TABLE campaigns ADD COLUMN sheet_name TEXT;

CREATE UNIQUE INDEX campaigns_spreadsheet_id_unique
  ON campaigns(spreadsheet_id)
  WHERE spreadsheet_id IS NOT NULL;
