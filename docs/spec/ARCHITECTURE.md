# 客户工作台 v2 · 技术架构与接口契约

前端与后端分别由不同的 Codex 任务并行实现，**本文件中的数据库结构、命令名、类型是双方契约，任何一方不得私自更改**。确需修改，在交付说明里写明理由，由 Claude 统一调整。

## 1. 技术栈

| 层 | 选型 |
|---|---|
| 桌面壳 | Tauri 2（Windows，NSIS 安装包，`currentUser` 安装） |
| 后端 | Rust 2021：`rusqlite`(bundled, backup)、`serde`/`serde_json`、`uuid` v4、`chrono`、`walkdir`、`thiserror`、`tempfile`(dev) |
| Tauri 插件 | `dialog`（选文件夹/文件/保存位置）、`opener`（打开文件、在资源管理器中显示）、`single-instance`、`updater` + `process`（第 3 阶段）；窗口位置由应用自己保存（2.0.1 起移除 `window-state` 插件，见 §4.3） |
| 前端 | React 19 + TypeScript strict + Vite 6 |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite`），所有颜色走 CSS 变量 token |
| 组件原语 | Radix UI（dialog, dropdown-menu, context-menu, popover, select, tooltip, tabs, checkbox, scroll-area） |
| 数据 | `@tanstack/react-query`（服务端状态）、`zustand`（UI 状态，偏好持久化到 localStorage） |
| 其他 | `cmdk`（命令面板）、`@dnd-kit/core` + `@dnd-kit/sortable`（看板）、`recharts`（收入图）、`date-fns` + `zh-CN`、`sonner`（toast）、`lucide-react`、`clsx` + `tailwind-merge`、`@fontsource-variable/inter` |
| 测试 | 前端 `vitest` + `@testing-library/react` + `jsdom`；后端 `cargo test` |

应用信息：productName `客户工作台`，identifier `com.moshangqingchen.clientdesk`，version `2.0.0`，Cargo 包名 `client-desk`（lib 名 `client_desk_lib`）。窗口默认 1440×900，最小 1100×700，`decorations: true`。

## 2. 目录结构

```
src-tauri/
  Cargo.toml  tauri.conf.json  build.rs  capabilities/default.json  icons/
  src/
    main.rs            # 调用 lib::run()
    lib.rs             # Builder、插件、State、命令注册、启动时自动备份
    error.rs           # AppError（thiserror），序列化为 { code, message }
    db.rs              # 打开连接（WAL、foreign_keys=ON）、迁移（PRAGMA user_version）
    schema.sql         # v1 建表语句（include_str!）
    models.rs          # 所有 serde 结构体，#[serde(rename_all = "camelCase")]
    repo/              # 纯数据访问，函数签名接收 &Connection / &Transaction，便于测试
      clients.rs projects.rs payments.rs tags.rs activities.rs snippets.rs settings.rs trash.rs
    library.rs         # 文件库：路径解析、文件夹命名、列文件、复制、回收、重命名
    backup.rs          # 数据库备份/恢复/轮转
    commands.rs        # #[tauri::command] 薄封装，只做参数转换和锁
  tests/               # 集成测试（tempdir 中的真实 SQLite 与文件库）

src/
  main.tsx  App.tsx
  styles/tokens.css    # 两套主题的 CSS 变量（见 DESIGN.md §3）
  styles/globals.css   # @import "tailwindcss"; @theme inline 映射 token；基础排版
  api/
    types.ts           # 本文件 §5 的类型，逐字照搬
    client.ts          # Api 接口定义 + 运行时选择实现：Tauri 环境用 tauri.ts，否则动态 import mock
    tauri.ts           # invoke 实现
    mock/              # 浏览器开发模式的内存实现 + 种子数据 + 示例图片（只在非 Tauri 环境被动态加载）
  lib/                 # 纯函数 + 单测：money.ts dates.ts status.ts colors.ts files.ts stats.ts filters.ts search.ts
  stores/              # nav.ts（页面 + 参数 + 历史栈）ui.ts（主题、侧栏折叠、面板宽度、视图偏好）
  hooks/               # queries.ts（react-query 封装）useHotkeys.ts useFileDrop.ts useCopy.ts
  components/
    ui/                # 设计系统组件（DESIGN.md §7）
    illustrations/     # 空状态 SVG
    layout/            # AppShell Sidebar CommandPalette PageHeader
    project/ client/ files/ payments/ tags/ activity/
  pages/               # Today Projects Clients Income Files Snippets Settings Onboarding
```

## 3. 数据库（SQLite，`<app_data_dir>/client-desk.db`）

时间戳为 UTC ISO8601 文本（`2026-11-02T08:30:00Z`）；日期字段为本地日期 `YYYY-MM-DD` 文本；金额为整数分；布尔为 0/1；软删除用 `deleted_at`。

```sql
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
```

默认设置（首次建库写入）：
- `subfolderTemplate`：`["参考资料","过程稿","交付成品"]`
- `paymentMethods`：`["微信","支付宝","淘宝","闲鱼","银行转账","现金","其他"]`
- `sourcePlatforms`：`["淘宝","闲鱼","小红书","微信","抖音","转介绍","其他"]`
- `lastPaymentMethod`：`"微信"`，`theme`：`"system"`，`libraryRoot`：未设置
- `lastAutoBackupDate`：空

## 4. 业务规则（后端负责保证）

1. **自动动态**（与主操作同一事务）：创建项目 → `created`「创建了项目」；状态变化 → `status`，`meta: {from, to}`；新增/删除收款 → `payment`，`meta: {kind, amountCents, method}`；添加文件 → `file`「添加了 N 个文件」，`meta: {names: [...]}`。
2. 状态改为 `delivered` 时若 `delivered_at` 为空则写当天；改为 `done` 写 `completed_at`；从 `done` 改回其他状态清空 `completed_at`。
3. 删除客户 = 软删除客户 + 其未删除的项目（标 `deleted_with_client=1`）；恢复客户一起恢复这些项目。彻底删除客户连带删除其项目、收款、动态、标签关联（文件夹不动，只提示）。
4. 列表接口一律排除 `deleted_at IS NOT NULL`。
5. 标签合并：把 source 的所有关联改到 target（冲突忽略），删除 source。
6. 收款 `amount_cents` 必须 > 0；超额不拦截（前端确认）。

### 4.1 文件库

- `libraryRoot` 绝对路径存在 settings。设置时校验：存在、是目录、可写（写入并删除一个临时文件）。设置成功后把该目录加入 asset protocol 作用域（`app.asset_protocol_scope().allow_directory(root, true)`），每次启动也要重新加入。
- 客户文件夹：`sanitize(name)`，重名加 ` (2)`… ；客户资料子目录 `_客户资料`。
- 项目文件夹：`<客户文件夹>/<YYYY-MM> <sanitize(title)>`（YYYY-MM 取项目创建月），创建时按 `subfolderTemplate` 建子目录。
- 文件夹在「首次需要」时创建（添加文件、打开文件夹），并回写 `folder`。若记录的 folder 已不存在，`files_list` 返回空列表并在结果中带 `folderMissing: true`，不自动重建。
- `sanitize`：替换 `\/:*?"<>|` 和控制字符为 `_`，去首尾空格和点，空则用 `未命名`，截断到 80 字符；Windows 保留名（CON、PRN、AUX、NUL、COM1–9、LPT1–9）加后缀 `_`。
- 列文件：递归最多 3 层，忽略以 `.` 或 `~$` 开头的文件、`Thumbs.db`、`desktop.ini`；`folderGroup` 为相对项目（或客户资料）文件夹的子目录路径（根目录为 `""`）。客户维度 `includeProjects=true` 时同时返回 `_客户资料` 与所有项目文件夹的文件（带 projectId）。
- 复制入库：目标重名时 `名称 (2).ext`；源是文件夹时整体递归复制。返回新增的 FileEntry。
- 删除文件：移动到 `<root>/_回收站/<原相对路径>`，重名加时间戳后缀。
- 重命名：只改文件名，不允许包含路径分隔符；重名报错 `code: "exists"`。
- 客户/项目改名时 `update` 补丁里带 `renameFolder: true` 才重命名文件夹；失败返回 `code: "folderRenameFailed"` 但记录本身照样保存（返回值 `warning` 字段）。
- `files_recent`：遍历整个文件库（跳过 `_备份`、`_回收站`），按修改时间取前 N，并通过 folder 前缀反查 clientId / projectId。
- 文件类型 `kind`：image（png jpg jpeg webp gif bmp svg）、design（psd psb ai cdr sketch fig xd indd eps afdesign afphoto）、pdf、doc（doc docx xls xlsx ppt pptx txt md wps et dps csv）、archive（zip rar 7z）、video（mp4 mov avi mkv webm）、其余 other。

### 4.2 备份

- 位置：`<libraryRoot>/_备份/`，未设置文件库时用 `<app_data_dir>/backups/`。
- 文件名：`client-desk-YYYYMMDD-HHMMSS.db`，使用 rusqlite backup API 生成一致快照。
- 自动：应用启动时若 `lastAutoBackupDate` ≠ 今天则备份并更新；保留最新 30 份自动备份（手动备份不轮转，文件名加 `-manual`）。
- 恢复：先对当前库做一次 `-before-restore` 备份，再用 backup API 把选中文件恢复到当前连接；恢复后前端整体刷新。

### 4.3 便携模式（2.0.1 起）

用户要求「所有东西都在项目文件夹里」。安装目录旁可放 `portable.json` 开启便携模式：

```json
{ "dataDir": "..\\我的数据\\应用数据", "libraryDir": "..\\我的数据\\客户资料库" }
```

- 位置：`<exe 所在目录>/portable.json`；相对路径以 exe 所在目录为基准解析，也接受绝对路径。`libraryDir` 可省略。
- 文件不存在 → 行为与之前完全一致（`<app_data_dir>`）。文件存在但无法解析或 `dataDir` 不可写 → 弹系统错误框说明原因并退出，**绝不**悄悄退回 AppData（否则用户会看到空库以为数据丢了）。
- 便携模式下，本应用写入的一切都在 `dataDir` 内：SQLite 及其 `-wal/-shm`、`backups/`（仅未设置文件库时；设置后按 §4.2 写入 `<libraryRoot>/_备份/`）、窗口位置 `window-state.json`（两种模式都由应用自己保存，不再用 window-state 插件）、WebView2 用户数据（`<dataDir>/webview`）。不得在 `%APPDATA%`、`%LOCALAPPDATA%` 下创建以 identifier 命名的任何文件或空目录。例外：更新包下载用系统临时目录（插件行为，下载完即用）。
- `libraryDir` 只用于首次引导的「建议位置」，真正的文件库仍由用户确认后经 `library_set_root` 写入设置。
- 非便携安装（GitHub 下载的普通安装包）不受影响。

## 5. 前端类型（`src/api/types.ts` 逐字使用）

```ts
export type ID = string;
export type ProjectStatus = "lead" | "active" | "review" | "delivered" | "done" | "cancelled";
export type PaymentKind = "income" | "refund";
export type TagColor = "red" | "orange" | "amber" | "lime" | "green" | "teal" | "cyan" | "blue" | "violet" | "pink" | "gray";
export type FileKind = "image" | "design" | "pdf" | "doc" | "archive" | "video" | "other";
export type ActivityKind = "note" | "status" | "payment" | "file" | "created";

export interface Tag { id: ID; name: string; color: TagColor; sort: number; clientCount: number; projectCount: number; }

export interface ClientAccount { platform: string; handle: string; }

export interface Client {
  id: ID; name: string; company: string; phone: string; wechat: string; email: string; address: string;
  accounts: ClientAccount[]; rating: number; pinned: boolean; notes: string; folder: string | null;
  tagIds: ID[]; createdAt: string; updatedAt: string;
  // 派生
  projectCount: number; openProjectCount: number;      // open = 非 done/cancelled
  billedCents: number;                                 // Σ price（排除 cancelled）
  receivedCents: number;                               // Σ 收款净额
  outstandingCents: number;                            // Σ 各项目待收
  firstProjectAt: string | null; lastActivityAt: string;
}
export type ClientInput = {
  name: string; company?: string; phone?: string; wechat?: string; email?: string; address?: string;
  accounts?: ClientAccount[]; rating?: number; pinned?: boolean; notes?: string; tagIds?: ID[];
};
export type ClientPatch = Partial<Omit<ClientInput, "tagIds">> & { renameFolder?: boolean };

export interface Project {
  id: ID; clientId: ID; clientName: string; title: string; status: ProjectStatus; pinned: boolean;
  brief: string; sourcePlatform: string; sourceOrderNo: string;
  startDate: string | null; dueDate: string | null; deliveredAt: string | null; completedAt: string | null;
  priceCents: number; costCents: number; tagIds: ID[]; folder: string | null;
  createdAt: string; updatedAt: string;
  // 派生
  receivedCents: number; paymentCount: number; fileCount: number;
  coverPath: string | null; // 项目文件夹（递归 ≤3 层）中最近修改的图片（png/jpg/jpeg/webp/gif，≤25MB）的绝对路径；与 fileCount 同一次扫描、同一缓存
}
export type ProjectInput = {
  clientId: ID; title: string; status?: ProjectStatus; pinned?: boolean; brief?: string;
  sourcePlatform?: string; sourceOrderNo?: string; startDate?: string | null; dueDate?: string | null;
  priceCents?: number; costCents?: number; tagIds?: ID[];
};
export type ProjectPatch = Partial<Omit<ProjectInput, "tagIds" | "status">> & { renameFolder?: boolean };

export interface Payment {
  id: ID; projectId: ID; kind: PaymentKind; amountCents: number; paidAt: string; method: string; note: string; createdAt: string;
}
export interface PaymentWithContext extends Payment { projectTitle: string; clientId: ID; clientName: string; }
export type PaymentInput = { projectId: ID; kind?: PaymentKind; amountCents: number; paidAt: string; method?: string; note?: string; };
export type PaymentPatch = Partial<Omit<PaymentInput, "projectId">>;

export interface Activity {
  id: ID; clientId: ID; projectId: ID | null; projectTitle: string | null; clientName: string;
  kind: ActivityKind; body: string; meta: Record<string, unknown>; createdAt: string;
}

export interface SnippetGroup { id: ID; name: string; sort: number; }
export interface Snippet { id: ID; groupId: ID; title: string; body: string; sort: number; useCount: number; updatedAt: string; }

export interface FileEntry {
  path: string; relPath: string; name: string; ext: string; kind: FileKind;
  sizeBytes: number; modifiedAt: string; folderGroup: string;
  clientId: ID | null; projectId: ID | null;
}
export interface FileListResult { files: FileEntry[]; folder: string | null; folderMissing: boolean; }
export interface FilesAddResult { added: FileEntry[]; failed: { name: string; message: string }[]; } // 2b 起 files_add / files_pick_and_add 返回此类型
export type FileTarget = { projectId: ID } | { clientId: ID };

export interface LibraryStatus {
  root: string | null; state: "ready" | "notConfigured" | "missing" | "readOnly"; freeBytes: number | null; message: string;
}
export interface Settings {
  theme: "light" | "dark" | "system"; subfolderTemplate: string[]; paymentMethods: string[];
  sourcePlatforms: string[]; lastPaymentMethod: string;
}
export interface BackupInfo { fileName: string; path: string; sizeBytes: number; createdAt: string; kind: "auto" | "manual" | "beforeRestore"; }
export interface TrashItem { type: "client" | "project"; id: ID; title: string; subtitle: string; deletedAt: string; }
export interface AppInfo { version: string; dataDir: string; dbPath: string; portable: boolean; suggestedLibraryRoot: string | null; }
export interface MutationResult<T> { value: T; warning: string | null; }
export interface AppErrorPayload { code: string; message: string; }
```

## 6. 命令（Tauri `invoke` 名 ↔ `Api` 方法）

参数对象键名为 camelCase（Tauri 自动映射到 Rust snake_case 形参）。所有命令返回 `Result<T, AppError>`。

| invoke 名 | 参数 | 返回 |
|---|---|---|
| `app_info` | – | `AppInfo` |
| `app_open_data_dir` | – | `void`（用资源管理器打开数据目录） |
| `library_status` | – | `LibraryStatus` |
| `library_set_root` | `{ path }` | `LibraryStatus` |
| `library_open_root` | – | `void` |
| `clients_list` | – | `Client[]` |
| `client_get` | `{ id }` | `Client` |
| `client_create` | `{ input: ClientInput }` | `Client` |
| `client_update` | `{ id, patch: ClientPatch }` | `MutationResult<Client>` |
| `client_delete` | `{ id }` | `void` |
| `projects_list` | – | `Project[]` |
| `project_get` | `{ id }` | `Project` |
| `project_create` | `{ input: ProjectInput }` | `Project` |
| `project_update` | `{ id, patch: ProjectPatch }` | `MutationResult<Project>` |
| `project_set_status` | `{ id, status }` | `Project` |
| `project_duplicate` | `{ id }` | `Project`（标题加「（副本）」，不复制收款/文件/动态，状态 lead） |
| `project_delete` | `{ id }` | `void` |
| `payments_list` | `{ projectId }` | `Payment[]`（按 paidAt 降序） |
| `payments_all` | – | `PaymentWithContext[]`（排除已删除项目） |
| `payment_add` | `{ input: PaymentInput }` | `Payment` |
| `payment_update` | `{ id, patch: PaymentPatch }` | `Payment` |
| `payment_delete` | `{ id }` | `void` |
| `tags_list` | – | `Tag[]`（按 sort, name） |
| `tag_create` | `{ name, color }` | `Tag` |
| `tag_update` | `{ id, patch: { name?, color?, sort? } }` | `Tag` |
| `tag_delete` | `{ id }` | `void` |
| `tag_merge` | `{ sourceId, targetId }` | `Tag` |
| `client_set_tags` | `{ clientId, tagIds }` | `void` |
| `project_set_tags` | `{ projectId, tagIds }` | `void` |
| `activities_list` | `{ clientId?, projectId?, limit? }` | `Activity[]`（降序；只给 clientId 时含其所有项目动态） |
| `activities_recent` | `{ limit }` | `Activity[]` |
| `activity_add_note` | `{ clientId, projectId?, body }` | `Activity` |
| `activity_update_note` | `{ id, body }` | `Activity`（只允许 kind=note） |
| `activity_delete` | `{ id }` | `void`（只允许 kind=note） |
| `files_list` | `{ target: FileTarget, includeProjects? }` | `FileListResult` |
| `files_recent` | `{ limit }` | `FileEntry[]` |
| `files_add` | `{ target: FileTarget, sourcePaths: string[], subfolder? }` | `FilesAddResult`（2b 起） |
| `files_pick_and_add` | `{ target: FileTarget, subfolder? }` | `FilesAddResult`（2b 起；弹系统多选对话框，取消返回空结果） |
| `file_open` | `{ path }` | `void` |
| `file_reveal` | `{ path }` | `void` |
| `file_rename` | `{ path, newName }` | `FileEntry` |
| `file_trash` | `{ path }` | `void` |
| `folder_open` | `{ target: FileTarget }` | `void`（必要时先创建） |
| `pick_folder` | `{ title? }` | `string \| null` |
| `snippet_groups_list` / `snippet_group_create {name}` / `snippet_group_update {id, patch:{name?, sort?}}` / `snippet_group_delete {id}` | | |
| `snippets_list` / `snippet_create {input:{groupId,title,body}}` / `snippet_update {id, patch}` / `snippet_delete {id}` / `snippet_mark_used {id}` | | |
| `settings_get` | – | `Settings` |
| `settings_update` | `{ patch: Partial<Settings> }` | `Settings` |
| `backups_list` | – | `BackupInfo[]` |
| `backup_create` | – | `BackupInfo` |
| `backup_restore` | `{ fileName }` | `void` |
| `trash_list` | – | `TrashItem[]` |
| `trash_restore` | `{ type, id }` | `void` |
| `trash_purge` | `{ type, id }` | `void` |
| `save_text_file` | `{ defaultName, content }` | `string \| null`（弹保存对话框，UTF-8 带 BOM，返回保存路径） |

路径安全：所有接收 `path` 的文件命令必须校验路径在 `libraryRoot` 之内（规范化后前缀比较），否则 `code: "outsideLibrary"`。

拖拽：前端监听 `getCurrentWebview().onDragDropEvent`，用事件坐标（物理像素 ÷ devicePixelRatio）配合 `document.elementFromPoint` 找最近的 `[data-drop-target]`（值为 `project:<id>` 或 `client:<id>`），调用 `files_add`。`over` 事件时给目标加高亮。

缩略图：前端用 `convertFileSrc(path)`；超过 25MB 的图片不加载缩略图，显示类型图标。`tauri.conf.json` 开启 `assetProtocol.enable`，静态 scope 为空，运行时由后端添加。CSP 允许 `img-src 'self' data: blob: asset: http://asset.localhost`。

## 7. 浏览器开发模式（Mock）

`npm run dev` 在普通浏览器里也必须完整可用，这是 Claude 验收界面的主要方式：

- `src/api/client.ts`：`isTauri = "__TAURI_INTERNALS__" in window`；否则 `await import("./mock")`。生产构建里 mock 必须是独立的懒加载 chunk。
- Mock 完整实现 `Api` 接口全部方法，行为与后端规则一致（自动动态、软删除、标签合并、状态时间戳等），数据存 `localStorage`（键 `clientdesk.mock.v1`），提供 `window.__mock.reset()` 恢复种子数据。
- 种子数据：真实感的中文样例 —— 14 个客户（个人与店铺混合，部分有多个平台账号）、32 个项目（覆盖所有状态，含 3 个逾期、2 个明天到期、若干无截止日）、约 40 笔收款（含 2 笔退款，覆盖近 12 个月，让收入图有起伏）、10 个标签、60+ 条动态、3 组共 12 条话术。日期相对「今天」生成，保证任何一天打开都有逾期/即将到期数据。
- Mock 文件：用 `src/api/mock/assets/` 下 6–8 张示例设计图（webp，每张 < 120KB）+ 若干非图片条目（psd、ai、pdf、zip）。`thumbnail` 在 mock 下返回这些资源的 URL。`file_open`/`reveal` 弹 toast 模拟。拖拽在浏览器里用 HTML5 drop 事件模拟（只记录文件名和大小）。
- 首次启动（`libraryRoot` 未设置）流程在 mock 中同样可走：`pick_folder` 返回 `D:\\客户工作台`。

## 8. 前端约定

- 所有服务端数据只通过 `hooks/queries.ts` 中的 react-query hooks 读写；mutation 成功后精确失效相关 query key（如改项目同时失效 `projects`、`project:id`、`client:clientId`、`activities`、`tags`）。状态切换、星标、看板拖拽使用乐观更新。
- 所有派生计算（收款状态、待收、逾期判断、收入统计、筛选、排序、相对日期）放在 `src/lib/` 纯函数中并写单元测试。
- 「今天」统一来自 `lib/dates.ts` 的 `today()`（本地日期），测试中可注入。
- 组件文件 ≤ 300 行，超过就拆。不写死颜色；不使用 `any`。
- 文案全部简体中文。

## 9. 构建与验证命令

```
npm install
npm test            # vitest run
npm run build       # tsc -b && vite build
npm run dev         # 浏览器 mock 模式，端口 1420
cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings
npm run tauri build # 生成 NSIS 安装包
```
