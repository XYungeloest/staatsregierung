-- Getrennte private Kampagnendatenbank; keine öffentlichen Leseendpunkte.
CREATE TABLE IF NOT EXISTS submissions (
  request_id TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS submissions_expiry ON submissions(expires_at);
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
