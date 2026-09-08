CREATE TABLE research_cache (
  key TEXT PRIMARY KEY,
  input_json TEXT NOT NULL,
  report TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  searched_at TEXT NOT NULL
);

CREATE INDEX research_cache_freshness ON research_cache (searched_at DESC);
