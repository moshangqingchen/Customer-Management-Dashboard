CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  wechat TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  accounts TEXT NOT NULL DEFAULT '[]',      -- JSON: [{platform, handle}]
  rating INTEGER NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  pinned INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  folder TEXT,                               -- 相对文件库路径，首次需要时创建
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('lead','active','review','delivered','done','cancelled')),
  pinned INTEGER NOT NULL DEFAULT 0,
  brief TEXT NOT NULL DEFAULT '',
  source_platform TEXT NOT NULL DEFAULT '',
  source_order_no TEXT NOT NULL DEFAULT '',
  start_date TEXT, due_date TEXT, delivered_at TEXT, completed_at TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  folder TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
  deleted_with_client INTEGER NOT NULL DEFAULT 0  -- 随客户一起删除的标记，恢复客户时一起恢复
);
CREATE INDEX idx_projects_client ON projects(client_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'income' CHECK (kind IN ('income','refund')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_at TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_payments_project ON payments(project_id);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT NOT NULL DEFAULT 'gray',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE client_tags (client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (client_id, tag_id));
CREATE TABLE project_tags (project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (project_id, tag_id));

CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('note','status','payment','file','created')),
  body TEXT NOT NULL DEFAULT '',
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_activities_client ON activities(client_id, created_at);
CREATE INDEX idx_activities_project ON activities(project_id, created_at);

CREATE TABLE snippet_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE snippets (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES snippet_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL, body TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0, use_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
