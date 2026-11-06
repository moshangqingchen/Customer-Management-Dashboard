## 完成

- 客户与项目详情的「已存文件」搜索框旁新增「文件排序」：修改时间最新优先、修改时间最早优先、文件名 A 到 Z、文件名 Z 到 A。网格与列表均生效，搜索后仍沿用排序。
- 文件名按中文自然数字顺序比较，例如 01、02、03、10；时间按实际时刻比较，无效时间置于末尾，同值使用文件名和路径稳定排序。排序仅影响目录内文件，不改变目录分组顺序，也不修改源数组或磁盘文件。
- 排序偏好保存在现有 `clientdesk.ui.v1` 中。切换排序保留选中项与目录折叠状态，Shift 范围选择及预览前后切换使用当前显示顺序。
- 已打包并原位安装 **2.3.1** 到 `D:\project development\创业客户管理工作台\app`，保留 `portable.json` 与原客户、项目、文件数据。实际窗口已打开用户截图中的项目文件区，并留在列表视图、文件名升序。
- 升级前备份程序、应用数据与资料库，共 541 个文件、146,244,036 字节，逐文件 SHA256 校验通过；另保存 SQLite 一致快照与业务表摘要。
- 本次备份：`D:\project development\创业客户管理工作台\我的数据\升级备份\2.3.1-升级前-20261105-203139`。

## 未完成 / 偏离规格

- 无。此次覆盖截图所在的详情文件区，不扩展全库文件页，不变更 API、数据库结构或规格文档。

## 验证

- `npm.cmd test -- src/lib/files.test.ts src/stores/stores.test.ts src/components/files/FileSorting.test.tsx src/components/files/FileSearch.test.tsx src/components/files/FileWorkflow.test.tsx src/components/files/FilesArea.test.tsx src/components/files/FileHistory.test.tsx` → 退出码 0，原始结果：

```text
 Test Files  7 passed (7)
      Tests  38 passed (38)
   Start at  20:29:52
   Duration  19.79s (transform 394ms, setup 1.31s, collect 10.99s, tests 9.65s, environment 2.35s, prepare 363ms)
```

- 覆盖四种排序、中文数字名称、时区和无效日期、并列稳定顺序、不修改输入、目录顺序、筛选、视图切换、偏好保存、折叠及选中保留、多选范围与预览顺序。
- `npx.cmd tsc --noEmit --incremental false -p tsconfig.app.json` → 退出码 0。
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-tauri-signed.ps1`（`CARGO_NET_OFFLINE=true`）→ 退出码 0，原始结果摘录：

```text
✓ built in 4.04s
   Compiling client-desk v2.3.1 (D:\project development\创业客户管理工作台\src-tauri)
    Finished `release` profile [optimized] target(s) in 46.17s
    Finished 1 bundle at:
        D:\project development\创业客户管理工作台\src-tauri\target\release\bundle\nsis\客户工作台_2.3.1_x64-setup.exe (6.04 MiB)
    Finished 1 updater signature at:
        D:\project development\创业客户管理工作台\src-tauri\target\release\bundle\nsis\客户工作台_2.3.1_x64-setup.exe.sig
```

- `cargo run --manifest-path 'src-tauri/Cargo.toml' --example verify_update --offline -- 'src-tauri/target/release/bundle/nsis/客户工作台_2.3.1_x64-setup.exe' 'src-tauri/target/release/bundle/nsis/客户工作台_2.3.1_x64-setup.exe.sig' 'src-tauri/updater-private.key.pub'` → 退出码 0：`安装包与更新公钥的完整签名验证通过。`
- 旧程序正常关闭后执行安装器 `/S /UPDATE /D=<原 app 目录>` → `exitCode=0`；注册表 `DisplayVersion=2.3.1`。安装后 exe 与本次 release 构建逐字节一致，仅 Tauri 预期打包标记为 `UNK → NSS`。
- 安装包 SHA256：`B9EBABF65DBAA0A2135CB6FFFB48827C4F59E154AE7A78297BB32B6AE3888D0D`。
- 已安装 exe SHA256：`BCA573A72FF260F7517C56428C1101C5992681C3A5F7EDDE848EBF5577DA5403`。
- `python '.cache/deploy-2.3.1/verify-data.py' after-start` → 安装前与启动实测后均退出码 0；最终原始结果：

```json
{"phase": "after-start", "schema": 2, "integrity": "ok", "foreignKeys": "ok", "businessTablesUnchanged": {"activities": 13, "client_folder_aliases": 0, "client_management": 0, "client_merge_history": 0, "client_tags": 1, "clients": 2, "file_recycle": 0, "file_versions": 0, "follow_ups": 0, "payments": 0, "project_tags": 0, "projects": 2, "settings": 6, "snippet_groups": 0, "snippets": 0, "tags": 1}, "originalLibraryFilesVerified": 24, "portableConfigUnchanged": true, "libraryRootUnchanged": true}
```

- 原生窗口实测：项目原有 16 个交付文件正常显示；默认最新优先为 01、15、服务项目等顺序；切换最早优先后为 02、03、04…；切换文件名升序后为 01、02、03、04…，排序控件与列表同步更新。未提交任何业务表单或改动文件内容。
- `git diff --check` → 退出码 0；仅现有 LF/CRLF 提示，无空白错误。

## 给 Claude 的备注

- 主要实现：`src/lib/files.ts`、`src/stores/ui.ts`、`src/components/files/FilesArea.tsx`、`src/components/files/FileSearchBar.tsx`。新增集成测试 `src/components/files/FileSorting.test.tsx`，扩展文件工具与 UI store 测试。
- `groupFiles` 增加第四个可选 `FileSort` 参数，默认 `modified-desc`。UI store 使用 `detailFileSort` / `setDetailFileSort`；不涉及后端契约。无新增依赖。
- package、npm lock、Cargo、Cargo lock、Tauri 版本同步为 2.3.1。已安装本机，未发布线上更新，未 commit / push / 切分支。
- 保留 schema 2 和原数据路径；客户与项目各有 1 条原回收站记录，均保持原状。数据摘要核对仅允许启动逻辑更新自动备份日期。
- 详细安装与数据核对记录位于 `.cache/deploy-2.3.1/`。更新包签名不等同于 Windows Authenticode 证书签名。
- 构建使用现有代理与离线 Cargo 缓存；本次启动进程的 HTTP(S) 与 WebView2 配置使用 `http://127.0.0.1:10090`，未改全局网络设置。
