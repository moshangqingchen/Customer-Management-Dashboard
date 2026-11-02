# 任务 1c：后端修正——文件系统操作不要占着数据库锁

先读 `AGENTS.md`、`docs/spec/ARCHITECTURE.md` 和 `docs/codex-tasks/reports/1a-backend.md`。后端（`src-tauri/`）已由任务 1a 完成，这是 Claude 审查后的修正。

## 你的范围
只改 `src-tauri/`（不含 `icons/`、`updater-private.key*`、`target/`）。**不要碰** `src/`、根目录前端配置、`docs/spec/`——另一个 Codex 正在同时开发前端，另一个在生图。不改任何命令名、参数和返回类型（契约不变）。

## 问题
`AppState` 用一个全局 `Mutex<Connection>`，而 `state.read(...)` / `with_root(...)` 在持锁期间执行了文件系统操作：
1. `projects_list` / `project_get`：`from_row` 里调用 `library::project_file_count`，在锁内逐个遍历每个项目文件夹。文件库在 D 盘（可能是机械硬盘），项目多时会很慢，而且期间所有其他命令都在等锁。
2. `files_add` / `files_pick_and_add`：在锁内复制文件（可能是几百 MB 的 PSD），复制期间整个应用的数据查询全部阻塞。
3. `files_list`、`files_recent`、`file_rename`、`file_trash`、`folder_open` 同理在锁内做目录遍历或移动。

## 要求
1. 所有命令改为「短持锁」模式：持锁读出所需数据（libraryRoot、folder 路径、客户/项目信息）→ 释放锁 → 做文件系统工作 → 需要写库时（如回写 folder、写「添加了 N 个文件」动态）再短暂持锁写入。
2. `projects_list`：持锁查出全部行（不计 fileCount）→ 释放锁 → 在锁外计算每个项目的 fileCount。再加一个进程内缓存：key 为项目文件夹绝对路径，值为（计数，计算时间）；`files_add` / `file_trash` / `file_rename` / `folder_open` 涉及的文件夹使其缓存失效；缓存最长 30 秒有效。`project_get` 同理。
3. `files_add` 的文件夹创建与回写 folder 必须避免竞态：两个并发 `files_add` 指向同一个尚无 folder 的项目时，只能建出一个文件夹（可以用短持锁的「确保文件夹」步骤完成，再在锁外复制）。
4. 复制失败要部分可恢复：已复制成功的文件照常返回并写入动态；失败的文件在错误信息里列出名字。
5. 保持现有全部测试通过，并新增测试：
   - 并发两次 `files_add` 到同一个新项目，只产生一个项目文件夹；
   - 持有一个慢文件操作期间（可用测试钩子或大文件模拟），另一个线程的 `clients::list` 能在合理时间内返回（证明锁已释放）；
   - fileCount 缓存在 `files_add` 后被正确失效。

## 验证（结果原样写进交付说明）
在 `src-tauri/` 下：`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`、`cargo build`。

## 交付方式
在对话里回复交付说明，同时写入 `docs/codex-tasks/reports/1c-backend-locking.md`（Claude 通过这个文件得知你已完成）。
