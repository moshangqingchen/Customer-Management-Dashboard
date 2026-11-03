## 完成

- 已完成任务 4，版本升至 **2.0.1**；版本字段均按原格式手工修改，未运行版本重排脚本。
- 新增 `src-tauri/src/portable.rs`：在构造 Tauri 前读取 exe 旁的 `portable.json`，支持相对/绝对路径、可选 `libraryDir`、UTF-8 BOM，规范化路径并验证数据目录可创建、可写。配置错误时显示包含配置文件完整路径和原因的中文系统错误框并退出，不回退 AppData；拒绝 Windows `C:foo` 这种依赖盘符当前目录的路径。
- 主窗口改为 setup 中按原配置创建；便携模式显式使用 `<dataDir>/webview`。标题、1440×900 默认尺寸、1100×700 最小尺寸、居中、系统边框和拖放配置保留。
- 移除 `tauri-plugin-window-state` 及其权限/锁文件条目；新增 `window_state.rs`，两种模式共用 `<dataDir>/window-state.json`。保存普通窗口边界与最大化状态、恢复时检查所有显示器、完全越界时居中，移动/缩放后防抖 600ms，关闭时同步原子保存。
- Rust、TypeScript、Tauri 与 Mock 同步 `AppInfo.portable`、`suggestedLibraryRoot`。首次引导显示完整建议位置，支持「使用这个位置」直接确认创建文件库，以及「选择其他位置」；用户确认前不创建建议文件库。
- 设置「关于」新增数据位置、打开按钮和便携徽标。新增无参数 `app_open_data_dir`，仅用已有 opener 打开后端选定的数据目录；前端对应 `api.app.openDataDir()`，没有放宽原 `file_open` 的文件库路径限制。
- README 已增加便携配置、目录布局、整目录备份和移动后重新指定文件库的说明。
- 新增便携解析、目录创建、两种 AppInfo 模式、窗口状态和前端交互/契约测试。既有完整页面测试的冷懒加载等待统一延长至 5000ms；复杂客户流程增加总超时、跨整页导航改为等待目标标题，保留业务断言。
- 已审计对应实际 CLI 版本的 NSIS 官方模板，结论见下方；未运行任何安装包或卸载程序。

## 未完成 / 偏离规格

- 无未完成项。
- **备份位置存在规格歧义**：ARCHITECTURE §4.3 将 backups 列入 dataDir；同文件 §4.2 和任务目标布局又保留文件库 `_备份/`。本次沿用 §4.2 和任务布局：未配置文件库时写入 `dataDir/backups`，配置后仍写入 `libraryRoot/_备份`。按本任务目标布局，两处都位于项目的「我的数据」内。未修改规格文件，请 Claude 统一这一处措辞。
- 任务明确要求确认建议位置后由后端创建目录，因此 `library_set_root` 在校验绝对路径后增加创建缺失目录；不会在读取建议位置时自动写入设置或创建文件库。
- 无新增依赖；移除一个窗口状态插件依赖。

## 验证

所有下列验证已运行完毕后，才创建本报告。最终命令退出码均为 0。Cargo 验证使用离线缓存；GitHub 模板读取和签名构建中的本机联网均使用现有 `http://127.0.0.1:10090` 代理，没有直连回退。原始完整日志保存在 `.cache/portable-verification/`；下方命令结果摘录保留原文。

### 前端

`npm.cmd test` → 通过：

```text
 Test Files  40 passed (40)
      Tests  295 passed (295)
   Start at  15:46:05
   Duration  112.72s (transform 1.28s, setup 8.52s, collect 69.34s, tests 69.07s, environment 12.45s, prepare 1.86s)
```

`npm.cmd run build` → 通过：

```text
✓ 3264 modules transformed.
✓ built in 6.00s
```

### Rust

在 `src-tauri` 下执行：

- `cargo fmt --check` → 退出码 0，无标准输出。
- `cargo clippy --all-targets -- -D warnings` → 退出码 0，原文：

```text
    Checking client-desk v2.0.1 (D:\project development\创业客户管理工作台\src-tauri)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 5.42s
```

- `cargo test` → 48 项通过、0 失败（17 单元测试，31 集成测试；main/doc-tests 为 0 项）。原始各组结果：

```text
test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.11s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.23s
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.14s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.05s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

过程中曾出现两类失败，均已修复并完整重跑通过：前端真实懒加载超过默认一秒等待；新增 Rust AppInfo 单测使用 mock runtime 时触发 Windows 原生入口点加载错误，已改为直接验证纯信息构造/序列化，不在该单测启动 runtime。

### 签名构建

`powershell -ExecutionPolicy Bypass -File scripts\build-tauri-signed.ps1` → 退出码 0，生成安装包及 Tauri 更新签名。构建提示未设置私钥密码，随后签名成功；未输出或修改私钥。

```text
    Finished `release` profile [optimized] target(s) in 2m 07s
       Built application at: D:\project development\创业客户管理工作台\src-tauri\target\release\client-desk.exe
     Running makensis to produce D:\project development\创业客户管理工作台\src-tauri\target\release\bundle\nsis\客户工作台_2.0.1_x64-setup.exe
    Finished 1 bundle at:
        D:\project development\创业客户管理工作台\src-tauri\target\release\bundle\nsis\客户工作台_2.0.1_x64-setup.exe (5.80 MiB)

    Finished 1 updater signature at:
        D:\project development\创业客户管理工作台\src-tauri\target\release\bundle\nsis\客户工作台_2.0.1_x64-setup.exe.sig
```

- 安装包：`src-tauri/target/release/bundle/nsis/客户工作台_2.0.1_x64-setup.exe`
- 大小：**6,077,579 字节**（构建器显示 5.80 MiB）。
- SHA256：`C508E171F0A380AA7893355E2C1C050FD830E183EE75C3CE2EB2A7949C92C893`
- 更新签名：同路径 `.exe.sig`，**448 字节**。本次未运行安装包。

### 便携冒烟（不安装）

使用 `.cache/portable-verification/smoke.ps1` 分阶段执行 start、close、corrupt、finish，四个阶段均退出码 0。

1. 确认没有 `client-desk.exe`，两个 identifier 系统目录不存在。
2. 仅复制 release exe 到 `.cache/portable-smoke/app/`，写入 `{"dataDir":"..\\data","libraryDir":"..\\lib"}`；从项目根目录启动，验证路径基准确为 exe 目录。子进程设置现有代理及 WebView2 显式代理参数。
3. 启动至少 10 秒后调用 `CloseMainWindow()` 正常关闭，`WaitForExit(15000)` 成功；验证数据库、webview、窗口位置和 backups 存在。未确认的建议文件库没有被创建。首次引导实际显示了完整建议路径及两个按钮。
4. 写入损坏 JSON 后实际观察到标题「客户工作台 — 启动失败」的系统错误框，正文包含完整配置路径，以及「原因：JSON 格式不正确（key must be a string at line 1 column 3）」；点击「确定」后进程退出。没有启动空数据库或回退系统目录。
5. 两个系统目录始终不存在；已删除整个冒烟目录，最终无残留 `client-desk.exe`。未强杀进程。

原始输出：

```text
Portable smoke test: release executable only; no installer/uninstaller execution.
Preflight client-desk.exe process count: 0
APPDATA identifier directory exists: False
LOCALAPPDATA identifier directory exists: False
Started smoke process: 320876
CloseMainWindow(): True
Normal smoke exit code: 
data\client-desk.db exists: True
data\webview exists: True
data\window-state.json exists: True
data\backups exists: True
Saved window state: {
  "x": 552,
  "y": 230,
  "width": 1440.0,
  "height": 900.0,
  "maximized": false
}
Unconfirmed suggested library exists: False
APPDATA identifier directory exists: False
LOCALAPPDATA identifier directory exists: False
WaitForExit(15000) succeeded; Get-Process did not provide an exit code.
Started smoke process: 50224
Corrupt portable.json launched; inspect native error dialog, then dismiss its OK button.
Corrupt configuration process exited after native dialog dismissal (no forced termination).
APPDATA identifier directory exists: False
LOCALAPPDATA identifier directory exists: False
Smoke directory removed: True
Remaining client-desk.exe process count: 0
```

上方正常退出码一行为空，是重新取得的 `Get-Process` 对象未提供退出码；已通过 `CloseMainWindow=True`、`WaitForExit=True` 和进程消失确认正常关闭，不将空值编造为 0。

- 额外 `git diff --check` → 退出码 0，仅有现有 Windows 换行转换提示，没有空白错误。
- 未运行 `tauri dev`；未安装/卸载；未修改真实 `app/` 或 `我的数据/`。

## 给 Claude 的备注

### NSIS 更新、重装、卸载安全审计

实际安装的 `node_modules/@tauri-apps/cli/package.json` 版本是 **2.12.4**，不是 package.json 中的最低范围版本 2.8.4。已通过本机现有代理读取对应官方标签的 [installer.nsi](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.4/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi) 和 [utils.nsh](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.4/crates/tauri-bundler/src/bundle/windows/nsis/utils.nsh)，没有执行安装或卸载。

| 场景 | 结论及 installer.nsi 行号 |
|---|---|
| 应用内 passive 更新 | 511–524 解析 `/P`、`/UPDATE`；335–338 更新模式直接跳过旧卸载。683–706 仅复制声明的主程序、资源、外部二进制，724 写卸载器；未知的 `portable.json` 不会被覆盖或删除。 |
| 手动同版本重装 | 344–349 分支允许直接重装或先卸载；直接重装仍只处理已声明文件。先卸载后的 407–408 仅删除旧卸载器并非递归尝试删除空目录，未知文件保留。 |
| 手动新版重装 | 350–355 允许先卸载或直接覆盖；两条路径均不会递归清除未知文件，`portable.json` 保留。 |
| 卸载 | 831–841 和 860 定点删除程序、声明资源、外部二进制和卸载器；863、865 为非递归 `RMDir`。未知 `portable.json`、未知数据子目录会使安装目录保留。 |
| 勾选删除应用数据 | 913–929 仅在非更新模式删除系统 `APPDATA/LOCALAPPDATA\BUNDLEID`；927–928 的递归删除不解析 `portable.json`，不涉及本任务项目旁的「我的数据」。 |
| 原安装位置 | 942–946 从注册表恢复原安装目录。 |

另核对本机 `tauri-plugin-updater-2.14.1`：passive 映射 `/P`，`src/updater.rs:1059–1061` 追加 `/UPDATE`，与上述模板分支一致。

**结论：当前配置无需 installer hooks。** 当前没有把 `portable.json` 声明为打包资源或外部二进制。以后升级 CLI、修改资源清单时应重新审计。此为源码静态审计，遵守任务要求，未通过运行安装器验证。

源码取证保存在 `.cache/portable-audit/`：

- `installer.nsi` SHA256：`D00089D3B1A2C4A30D7B6E098079100CB8F25E980F84D4515ACA4597B95E967D`
- `utils.nsh` SHA256：`78272BD40B8A783C0AB94E4BCB400FD947BA306A7575F2BBBBCCB7478F40447F`

### 审查范围

- 新命令 `app_open_data_dir` 是任务允许的最小扩展，原有文件路径契约未改。
- 原工作区已有的 `.gitignore`、`docs/spec/ARCHITECTURE.md` 修改均保留，未改写；未编辑 `scripts/`、真实安装/数据目录和密钥。
- 未执行 git commit、push、切分支或 reset；仅保留工作区实现，供 Claude 审查提交。

