# 任务 1a：Rust 后端（Tauri 2）完整实现

> **注意**：这个任务之前用命令行跑过一次，中途被中断。工作区里已经有部分文件（你的范围内）。先检查现有内容：合格的保留并继续，不合格的直接重写。不要因为文件已存在就以为已经完成。

先完整阅读 `AGENTS.md` 和 `docs/spec/` 下三份规格。你负责 **ARCHITECTURE.md 中的全部后端**。

## 你的范围（只能改这些）
- `src-tauri/` 下除 `icons/`、`updater-private.key`、`updater-private.key.pub`、`target/` 以外的全部内容（目前这些都已删除，需要你新建）。
- 若仓库根目录没有 `dist/index.html`，创建一个最简占位文件（`dist/` 已被 gitignore，用于让 `tauri::generate_context!` 编译通过）。
- **不要碰** `src/`、`package.json`、根目录配置、`docs/`——另一个 Codex 正在同时开发前端。

## 要做的
1. `Cargo.toml`（包名 `client-desk`，lib `client_desk_lib`，version 2.0.0，crate-type staticlib/cdylib/rlib）、`build.rs`、`tauri.conf.json`（productName `客户工作台`、identifier `com.moshangqingchen.clientdesk`、`build.devUrl` http://localhost:1420、`beforeDevCommand` `npm.cmd run dev`、`beforeBuildCommand` `npm.cmd run build`、`frontendDist` ../dist、窗口 1440×900 最小 1100×700 居中、NSIS currentUser、assetProtocol 开启、CSP 见 ARCHITECTURE §6；先不要配置 updater，第 3 阶段再加）、`capabilities/default.json`（core 默认权限 + 前端需要的 webview 拖放事件、窗口焦点事件；window-state 插件权限）。
2. 插件：`tauri-plugin-dialog`、`tauri-plugin-opener`、`tauri-plugin-single-instance`（第二次启动时聚焦已有窗口）、`tauri-plugin-window-state`。
3. 按 ARCHITECTURE §2 的模块划分实现：`error.rs`、`db.rs`（WAL、foreign_keys、`PRAGMA user_version` 迁移，v1 = `schema.sql`）、`models.rs`、`repo/*`、`library.rs`、`backup.rs`、`commands.rs`、`lib.rs`。
4. 实现 ARCHITECTURE §6 表中**每一个**命令，类型与 §5 完全对应（serde camelCase）。派生字段（receivedCents、billedCents、outstandingCents、openProjectCount、firstProjectAt、lastActivityAt、paymentCount、fileCount、Tag 的 clientCount/projectCount、Activity 的 projectTitle/clientName）都要正确计算。`lastActivityAt` = 该客户最新 activity 的时间，没有则 updatedAt。
5. 业务规则 §4、文件库 §4.1、备份 §4.2 全部实现。启动时：打开/迁移数据库 → 写入默认设置（仅首次）→ 若文件库已设置则把它加入 asset protocol scope → 执行当天自动备份（失败只记日志，不阻止启动）。
6. 路径安全：所有接受 `path` 的命令校验在 libraryRoot 内（canonicalize 后比较；注意 Windows `\?\` 前缀）。
7. `AppError` 序列化为 `{ "code": "...", "message": "中文说明" }`，code 至少包括：`notFound`、`invalid`、`libraryNotConfigured`、`libraryUnavailable`、`outsideLibrary`、`exists`、`folderRenameFailed`、`io`、`db`。
8. 业务逻辑尽量写在不依赖 Tauri 运行时的函数里（接收 `&Connection` 和库根路径），命令层只做薄封装，这样集成测试不需要启动 Tauri。

## 测试（`src-tauri/tests/`，tempdir 中真实 SQLite + 文件库）
至少覆盖：迁移幂等；客户/项目 CRUD 与全部派生字段；状态变更写时间戳与动态；收款增删改与 received/outstanding（含退款、cancelled 排除）；标签增删改、合并（含冲突）、计数；客户软删除连带项目 + 恢复 + 彻底删除；回收站列表；sanitize（非法字符、保留名、空名、超长）；项目文件夹按需创建含子目录模板；files_add 重名编号与目录复制；files_list 分组与 includeProjects；file_rename 重名报错；file_trash 移动到 `_回收站`；路径越界被拒；files_recent 反查 clientId/projectId；备份创建、30 份轮转、恢复前自动备份、恢复后数据正确；activities_list 只给 clientId 时包含项目动态。

## 验证（全部通过才算完成，结果原样写进交付说明）
在 `src-tauri/` 下：
- `cargo fmt --check`
- `cargo clippy --all-targets -- -D warnings`
- `cargo test`
- `cargo build`

最后按 AGENTS.md 的格式写交付说明，并附上一份「命令清单」：每个命令的名字与参数，方便 Claude 与前端核对。

## 交付方式
完成后，除了在对话里回复，还要把同样的交付说明写入 `docs/codex-tasks/reports/1a-backend.md`（Claude 通过这个文件得知你已完成）。只有全部验证跑完才写这个文件。
