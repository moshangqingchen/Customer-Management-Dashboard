CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  due_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  result TEXT NOT NULL DEFAULT '',
  completed_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  reminded_revision INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_follow_ups_client ON follow_ups(client_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_follow_ups_due ON follow_ups(status, due_at);
