-- Migração aditiva da busca por tags e do relatório de termos pesquisados.
-- Idempotente: não altera tabelas existentes e pode ser executada mais de uma vez.

CREATE TABLE IF NOT EXISTS folder_search_tags (
  folder_path TEXT PRIMARY KEY,
  tags TEXT[] NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT folder_search_tags_nonempty CHECK (cardinality(tags) > 0)
);

CREATE TABLE IF NOT EXISTS catalog_search_events (
  id BIGSERIAL PRIMARY KEY,
  term_normalized TEXT NOT NULL,
  searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_search_events_searched_at
  ON catalog_search_events (searched_at);

CREATE INDEX IF NOT EXISTS idx_catalog_search_events_term_time
  ON catalog_search_events (term_normalized, searched_at);
