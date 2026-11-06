CREATE TABLE IF NOT EXISTS client_management (
    client_id TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    archived_at TEXT,
    merged_into TEXT
);
CREATE TABLE IF NOT EXISTS client_folder_aliases (
    folder TEXT PRIMARY KEY COLLATE NOCASE,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    source_name TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_client_folder_aliases_client ON client_folder_aliases(client_id);
CREATE TABLE IF NOT EXISTS client_merge_history (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    source_snapshot TEXT NOT NULL,
    target_snapshot TEXT NOT NULL,
    merged_at TEXT NOT NULL
);
