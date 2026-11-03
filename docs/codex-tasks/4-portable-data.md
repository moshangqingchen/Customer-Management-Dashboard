# 任务 4：便携模式——所有数据都放在项目文件夹里（版本 2.0.1）

先读 `AGENTS.md`、`docs/spec/ARCHITECTURE.md`（重点：新增的 §4.3「便携模式」和 §5 里扩展后的 `AppInfo`）。基线为 `main` 的 `eb986c4` 加上工作区里 Claude 刚改的 `.gitignore` 与 `ARCHITECTURE.md`。不要 commit。

## 背景
用户原话：「所有的东西都要在这个项目里面，你可以新建文件夹存储」。应用已经安装在项目里的 `app\`，可现在仍会往系统目录写东西：
- `%APPDATA%\com.moshangqingchen.clientdesk\`：`client-desk.db`（含 `-wal`、`-shm`）、`backups\`、`.window-state.json`（来自 `tauri-plugin-window-state`，它总是 `create_dir_all(app_config_dir)`）
- `%LOCALAPPDATA%\com.moshangqingchen.clientdesk\EBWebView\`：WebView2 用户数据

目标布局（Claude 负责安装和放置 `portable.json`，你只做代码）：
```
<项目>\app\client-desk.exe
<项目>\app\portable.json            {"dataDir":"..\\我的数据\\应用数据","libraryDir":"..\\我的数据\\客户资料库"}
<项目>\我的数据\应用数据\            数据库、backups、窗口位置、webview
<项目>\我的数据\客户资料库\          文件库（含 _备份、_回收站）
```

## 你的范围
`src-tauri/**`（不含 `updater-private.key*`、`target/`）、`src/**`、`package.json`、`package-lock.json`、`README.md`。不要动 `.gitignore`、`docs/spec/`、`app/`、`我的数据/`、`scripts/`。

## 后端
1. 新模块（如 `portable.rs`）：从 `std::env::current_exe()` 所在目录读取 `portable.json`，按 §4.3 解析出 Standard 或 Portable { data_dir, suggested_library_root }。相对路径以 exe 目录为基准，路径需规范化（不要留 `..`）。单元测试覆盖：文件不存在、相对路径、绝对路径、省略 `libraryDir`、JSON 损坏、`dataDir` 缺失。
2. 出错时（JSON 损坏、目录无法创建或不可写）：弹出中文系统错误框写明 `portable.json` 路径和原因，然后退出。**不能悄悄退回 AppData**。
3. `AppState::open` 使用解析出的数据目录。
4. **WebView2 数据目录**：便携模式下必须放到 `<dataDir>\webview`。推荐做法：`tauri.conf.json` 主窗口设为 `"create": false`，在 `setup` 里用 `WebviewWindowBuilder::from_config(...)` 创建，便携模式时加 `.data_directory(...)`；Standard 模式保持现有行为。确认拖放、标题、最小尺寸、居中等配置都不变。
5. **窗口位置**：移除 `tauri-plugin-window-state`（同时从 `Cargo.toml` 和 capabilities 里删掉），自己实现一个精简版：保存与恢复大小、位置、最大化状态，文件为 `<dataDir>\window-state.json`，两种模式共用。恢复时如果窗口落在任何显示器之外就居中显示，并遵守最小尺寸 1100×700。写盘时机：关闭窗口时，再加上移动或缩放后防抖保存（≥500ms）。
6. `app_info` 返回新增的 `portable`、`suggestedLibraryRoot` 字段。
7. **更新与卸载是否安全**：从 GitHub 读 Tauri v2 的 NSIS 模板（`tauri-apps/tauri` 仓库中 `crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi`，版本与本项目 `@tauri-apps/cli` 对应；网络必须走代理 `http://127.0.0.1:10090`），确认以下三种情况会不会删除或覆盖 `$INSTDIR` 里不认识的文件（也就是 `portable.json`）：应用内更新（`/UPDATE`、passive）、手动重装同版本或新版本、卸载。把结论连同相关行号写进报告；如有风险，给出缓解方案并实现（例如用 `bundle.windows.nsis` 的 installer hooks）。**不要在本机运行任何安装包或卸载程序**，用户的真实安装就在 `app\`。
8. 版本号升到 **2.0.1**，涉及 `package.json`、`package-lock.json`（顶层 `version` 和 `packages[""].version`）、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`（client-desk 那一项）、`src-tauri/tauri.conf.json`。**手工修改，保持原有格式**；不要运行 `scripts/set-version.ps1`，它会把整个 JSON 重新排版。

## 前端
1. `types.ts`、`tauri.ts`、Mock 同步新的 `AppInfo`。Mock 默认 `portable: false`；测试里两种模式都要覆盖。
2. **首次引导**（`src/pages/Onboarding.tsx`）：如果 `portable` 为真且有 `suggestedLibraryRoot`，提示框显示完整的建议路径；主按钮「使用这个位置」直接调用 `setRoot(建议路径)`（后端会负责创建文件夹），下方次要按钮「选择其他位置」走原来的选文件夹流程。否则保持现在的行为。补测试。
3. **设置 → 关于**：新增「数据位置」一行，显示 `dataDir`，旁边一个「打开」按钮用资源管理器打开该文件夹（复用已有命令；没有合适命令的话，在交付说明里写明你是怎么做的）。便携模式下加一个小徽标「便携模式 · 数据都在程序旁边」。
4. 视觉沿用晴空风格，文案简体中文。

## README
新增「便携模式」一节：`portable.json` 的写法、目录布局、怎样备份（复制 `我的数据` 整个文件夹即可）、移动项目文件夹后文件库需要在设置里重新指一次（数据库里存的是绝对路径）。

## 验证（结果原样写进交付说明）
- `npm.cmd test`、`npm.cmd run build`
- `src-tauri` 下：`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`
- 签名构建：`powershell -ExecutionPolicy Bypass -File scripts\build-tauri-signed.ps1`，写明安装包路径、大小、SHA256。
- **便携冒烟测试**（不安装）：
  1. 先确认没有 `client-desk.exe` 进程在运行，并确认 `%APPDATA%\com.moshangqingchen.clientdesk` 和 `%LOCALAPPDATA%\com.moshangqingchen.clientdesk` 都不存在（Claude 已清空）。
  2. 把 `src-tauri\target\release\client-desk.exe` 复制到 `<项目>\.cache\portable-smoke\app\`，旁边写 `portable.json`：`{"dataDir":"..\\data","libraryDir":"..\\lib"}`。
  3. 启动后等 10 秒，用 `CloseMainWindow()` 正常关闭（不要强杀），确认 `.cache\portable-smoke\data\` 里有 `client-desk.db`、`webview\`、`window-state.json`，并且上面两个系统目录**仍然不存在**。
  4. 再写一个损坏的 `portable.json`，确认会弹错误框并退出（截图或描述），而且系统目录依旧不存在。
  5. 结束后删除 `.cache\portable-smoke\`。
- 不要运行 `tauri dev`；如果运行了，说明它在系统目录留下了什么，并清理干净。

## 交付方式
对话中回复交付说明，同时写入 `docs/codex-tasks/reports/4-portable-data.md`。只有全部验证跑完才写这个文件。
