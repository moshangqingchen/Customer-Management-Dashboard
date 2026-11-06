CREATE TABLE IF NOT EXISTS file_versions (
    id TEXT PRIMARY KEY,
    library_id TEXT NOT NULL,
    original_rel_path TEXT NOT NULL,
    snapshot_rel_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    client_id TEXT,
    project_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_file_versions_path ON file_versions(library_id, original_rel_path);
CREATE TABLE IF NOT EXISTS file_recycle (
    id TEXT PRIMARY KEY,
    library_id TEXT NOT NULL,
    original_rel_path TEXT NOT NULL,
    stored_rel_path TEXT NOT NULL,
    client_id TEXT,
    project_id TEXT,
    deleted_at TEXT NOT NULL,
    legacy INTEGER NOT NULL DEFAULT 0,
    restored_at TEXT,
    restored_rel_path TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_recycle_path ON file_recycle(library_id, stored_rel_path);
