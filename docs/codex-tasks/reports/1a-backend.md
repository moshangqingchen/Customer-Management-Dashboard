## 完成
- 任务 1a 已完成。Tauri 2 后端实现并注册了全部 **61 个命令**，已与前端现有的 61 个 `invoke` 名称核对。Windows 调试构建已产出 [client-desk.exe](<D:/project development/创业客户管理工作台/src-tauri/target/debug/client-desk.exe>)。
- SQLite 已实现 v1 迁移、客户和项目管理、收退款、标签合并、动态、话术、设置和回收站。项目创建、状态变更及收款增删与对应动态在同一事务中提交。
- 文件库支持按需建目录、拖入文件或目录、重名编号、文件分组、归属反查和文件回收。备份支持每日快照、保留最近 30 份自动备份，以及恢复前保存当前数据库。
- 四项指定验证全部通过，共 **21 项测试通过，0 项失败**。[交付报告](<D:/project development/创业客户管理工作台/docs/codex-tasks/reports/1a-backend.md>)

## 未完成 / 偏离规格
- 无。

## 验证
在 `src-tauri` 下执行，四条命令退出码均为 `0`。

| 命令 | 结果 |
|---|---|
| `cargo fmt --check` | 无输出 |
| `cargo clippy --all-targets -- -D warnings` | ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 8.10s`` |
| `cargo test` | 21 项通过，测试目标的原始结果见下方 |
| `cargo build` | ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 16.07s`` |

按库、桌面入口、IPC、文件库、业务仓储、存储、文档测试的顺序，`cargo test` 返回：

```text
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s
test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.83s
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.15s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.84s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

## 给 Claude 的备注
- **有一处前后端口径需要对齐。** 后端按 1a 定义计算 `lastActivityAt`，取客户及其可见项目的最新动态时间，没有动态才回退到客户的 `updatedAt`。当前前端 mock 还会取项目或客户的更新时间，因此只编辑项目属性也可能改变客户排序。
- 文件夹重命名失败时，客户或项目的新名称仍会保存。更新命令返回保存后的 `value`，并在字符串 `warning` 中携带 `folderRenameFailed`，前端可直接提示用户。
- 沿用 `fs2` 查询磁盘可用空间，复用 `tempfile` 原子写入带 BOM 的 UTF-8 导出文件。IPC 测试使用 Tauri 的测试运行时。系统文件选择器、资源管理器和第二次启动聚焦已接线，本次没有手动桌面交互验收。

### 命令清单
括号中是传给 `invoke` 的对象键名，`?` 表示可省略。文件目标 `target` 为 `{ projectId }` 或 `{ clientId }`。

| 模块 | 命令及参数 |
|---|---|
| 应用 | `app_info()`、`save_text_file(defaultName, content)` |
| 文件库 | `library_status()`、`library_set_root(path)`、`library_open_root()`、`pick_folder(title?)` |
| 客户 | `clients_list()`、`client_get(id)`、`client_create(input)`、`client_update(id, patch)`、`client_delete(id)`、`client_set_tags(clientId, tagIds)` |
| 项目 | `projects_list()`、`project_get(id)`、`project_create(input)`、`project_update(id, patch)`、`project_set_status(id, status)`、`project_duplicate(id)`、`project_delete(id)`、`project_set_tags(projectId, tagIds)` |
| 收款 | `payments_list(projectId)`、`payments_all()`、`payment_add(input)`、`payment_update(id, patch)`、`payment_delete(id)` |
| 标签 | `tags_list()`、`tag_create(name, color)`、`tag_update(id, patch)`、`tag_delete(id)`、`tag_merge(sourceId, targetId)` |
| 动态 | `activities_list(clientId?, projectId?, limit?)`、`activities_recent(limit)`、`activity_add_note(clientId, projectId?, body)`、`activity_update_note(id, body)`、`activity_delete(id)` |
| 文件 | `files_list(target, includeProjects?)`、`files_recent(limit)`、`files_add(target, sourcePaths, subfolder?)`、`files_pick_and_add(target, subfolder?)`、`file_open(path)`、`file_reveal(path)`、`file_rename(path, newName)`、`file_trash(path)`、`folder_open(target)` |
| 话术分组 | `snippet_groups_list()`、`snippet_group_create(name)`、`snippet_group_update(id, patch)`、`snippet_group_delete(id)` |
| 话术 | `snippets_list()`、`snippet_create(input)`、`snippet_update(id, patch)`、`snippet_delete(id)`、`snippet_mark_used(id)` |
| 设置 | `settings_get()`、`settings_update(patch)` |
| 备份 | `backups_list()`、`backup_create()`、`backup_restore(fileName)` |
| 回收站 | `trash_list()`、`trash_restore(type, id)`、`trash_purge(type, id)` |
