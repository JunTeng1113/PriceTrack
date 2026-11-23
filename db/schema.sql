-- PriceTrack PostgreSQL schema (Railway)

CREATE TABLE IF NOT EXISTS gpu_quotes (
  code text NOT NULL,
  quote_date date NOT NULL,
  selling_price integer NOT NULL,
  chip_group text NOT NULL,
  row_text text NOT NULL,
  captured_at text NOT NULL,
  row_index integer NOT NULL,
  source text NOT NULL CHECK (source IN ('估價頁', '快照')),
  PRIMARY KEY (code, quote_date)
);

CREATE INDEX IF NOT EXISTS gpu_quotes_date_idx ON gpu_quotes (quote_date);
CREATE INDEX IF NOT EXISTS gpu_quotes_group_idx ON gpu_quotes (chip_group);
CREATE INDEX IF NOT EXISTS gpu_quotes_captured_idx ON gpu_quotes (captured_at);

CREATE TABLE IF NOT EXISTS memory_quotes (
  code text NOT NULL,
  quote_date date NOT NULL,
  selling_price integer NOT NULL,
  chip_group text NOT NULL,
  row_text text NOT NULL,
  captured_at text NOT NULL,
  row_index integer NOT NULL,
  source text NOT NULL CHECK (source IN ('估價頁', '快照')),
  PRIMARY KEY (code, quote_date)
);

CREATE INDEX IF NOT EXISTS memory_quotes_date_idx ON memory_quotes (quote_date);
CREATE INDEX IF NOT EXISTS memory_quotes_captured_idx ON memory_quotes (captured_at);

CREATE TABLE IF NOT EXISTS used_posts (
  id bigserial PRIMARY KEY,
  code text NOT NULL,
  post_date date NOT NULL,
  price integer NOT NULL,
  link text NOT NULL,
  seller text NOT NULL,
  UNIQUE (link, code, price)
);

CREATE INDEX IF NOT EXISTS used_posts_code_date_idx ON used_posts (code, post_date);

CREATE TABLE IF NOT EXISTS ingest_done (
  kind text NOT NULL CHECK (kind IN ('gpu', 'memory')),
  captured_at text NOT NULL,
  PRIMARY KEY (kind, captured_at)
);
