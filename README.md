# 客户工作台 v2

为独立设计师与创意工作室打造的 Windows 本地工作空间，串起客户、项目、文件和收款。数据保存在本机 SQLite，文件保存在自己选择的文件夹。v2 是全新工程，不兼容或迁移旧版数据。

## 功能

- 今日：关注逾期与即将到期的项目，查看收入、待收款和最近动态。
- 项目：列表与拖拽看板、智能排序、组合筛选、置顶、侧滑详情和就地编辑。
- 客户：联系方式、平台账号、评级、标签，以及项目、文件和动态汇总。
- 收入：周期指标与环比、近十二个月实收与利润、收款流水、CSV 导出及客户排行。金额以整数分存储，退款按负数统计。
- 文件：图片缩略图、文件类型图块、全库检索、拖入复制、重命名与回收。
- 话术：分组排序、跨组搜索、原样复制和使用计数。
- 设计文件缩略图：PSD、AI、CDR、PDF、视频及大图片按需加载 Windows 系统缩略图，支持设计文件项目封面；缺少缩略图时显示类型图块。设计文件缩略图依赖本机已安装软件提供的 Windows 缩略图处理程序，例如安装 CorelDRAW 并注册其处理程序后才有 CDR 缩略图。
- 大图预览：选中文件按空格或点击预览，方向键切换，Esc 关闭；支持系统打开、定位和复制文件。
- 复制文件：Ctrl/Shift 多选后复制文件本身，可粘贴到微信、QQ或邮件；项目支持一键复制「交付成品」中的文件。
- 粘贴入库：在项目或客户详情按 Ctrl+V，或点击「从剪贴板粘贴」，将文件或截图存入文件库；项目使用当前「添加到」子文件夹。
- 话术变量：编辑器可插入客户、项目、报价、已收、待收和截止日变量，在项目或客户详情选择话术时自动填写并复制。
- 设置：文件库、外观、标签合并、收款方式、来源平台、备份、回收站与更新。

快捷键：`Ctrl+1…6` 跳转主页面，`Ctrl+K` 搜索与命令，`Ctrl+N` 新建项目，`Ctrl+Shift+N` 新建客户，`/` 聚焦页面搜索，`Space` 预览选中的文件，`←/→` 切换预览，`Ctrl+V` 在详情粘贴文件或截图，`Esc` 关闭弹窗或面板。

## 文件库与备份

```text
你选择的文件库/
  _备份/
  _回收站/
  林女士/
    _客户资料/
    2026-11 双十一海报/
      参考资料/
      过程稿/
      交付成品/
```

客户与项目文件夹在首次使用时创建。子文件夹模板可在设置中编辑或清空。拖入文件会复制原文件；在 Photoshop 等软件里直接保存到项目文件夹，应用重新获得焦点后会刷新文件列表。更换文件库只改变指向，请先自行移动文件并保留原来的相对目录结构。

数据库位置可在「设置 → 关于」查看，文件名为 `client-desk.db`。每天首次启动自动生成一致性数据库快照，保留最近 30 份自动备份；手动备份独立保留。备份通常放在 `<文件库>/_备份/`，未配置文件库时放在应用数据目录的 `backups/`。恢复前会再备份当前数据库，恢复后刷新全部数据。

**数据库备份不包含设计文件**，请另外备份整个文件库。删除客户/项目先进入回收站，可撤销或恢复；彻底删除数据库记录不会删除实际客户文件夹。文件删除移到文件库 `_回收站/`。

## 便携模式

从 2.0.1 起，在 `client-desk.exe` 旁放置 UTF-8 编码的 `portable.json` 即可开启便携模式：

```json
{ "dataDir": "..\\我的数据\\应用数据", "libraryDir": "..\\我的数据\\客户资料库" }
```

两个路径都以程序所在目录为基准解析，也接受绝对路径。`dataDir` 必填；`libraryDir` 可省略，仅作为首次引导的建议位置，点击「使用这个位置」后才会建立并确认文件库。配置错误或数据目录不可写时，应用会显示错误框并退出，不会切换到系统目录创建空库。没有 `portable.json` 的普通安装继续使用原来的系统应用数据目录。

```text
项目/
  app/
    client-desk.exe
    portable.json
  我的数据/
    应用数据/
      client-desk.db
      backups/
      window-state.json
      thumbs/
      webview/
    客户资料库/
      _备份/
      _回收站/
      客户与项目文件夹…
```

便携模式将数据库及其附属文件、窗口位置、缩略图缓存和 WebView2 用户数据保存在 `dataDir`；数据库备份在未配置文件库时写入这里的 `backups/`，配置文件库后写入文件库的 `_备份/`。两种模式的系统缩略图都缓存在 `<dataDir>/thumbs/`，超过 300MB 时清理最久未使用的缓存。可在「设置 → 关于」查看并打开数据目录。

按上述布局使用时，**正常关闭应用后，复制整个 `我的数据` 文件夹即可备份应用数据和设计文件**；若文件库选在其他位置，还需一起备份那个文件夹。移动整个项目文件夹后，`portable.json` 中的相对路径仍会生效，但数据库保存的文件库位置是绝对路径，需要在「设置 → 文件库」重新指向移动后的 `客户资料库`，保留其原来的目录结构。

## 本地开发

需要 Node.js、Rust stable、Visual Studio C++ 生成工具与 Windows SDK、WebView2。使用 PowerShell 时运行 `npm.cmd`，避免执行策略拦截。

```powershell
npm.cmd install --proxy 'http://127.0.0.1:10090'
npm.cmd run dev
npm.cmd run tauri dev
npm.cmd test
npm.cmd run build
cd 'src-tauri'
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

浏览器预览地址为 `http://127.0.0.1:1420`，使用本地持久化 Mock 数据，可通过控制台 `window.__mock.reset()` 重置。Mock 是独立懒加载模块，桌面模式使用真实后端。

本机联网工具必须使用现有代理 `http://127.0.0.1:10090`，不可用时停止，不能回退直连。运行需要下载依赖的 Cargo/Tauri 命令前，在当前终端设置 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 为此地址，`NO_PROXY` 仅包含 `localhost,127.0.0.1,::1`。发布脚本会检查代理并设置子进程环境，不修改系统网络设置。

## 构建与发布

应用名为「客户工作台」，版本同时维护在 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`。更新使用原有公钥验证签名，私钥不能提交到仓库。

```powershell
# 同步版本（不生成 git 提交或标签）
./scripts/set-version.ps1 -Version '2.2.0'
# 生成带更新签名的 NSIS 安装包；可预先提供私钥及其密码环境变量
./scripts/build-tauri-signed.ps1
# 仅在本地准备更新清单，不联网发布
./scripts/create-update-manifest.ps1 -DownloadUrl 'https://github.com/moshangqingchen/Customer-Management-Dashboard/releases/download/v2.2.0/client-desk-2.2.0-x64-setup.exe' -Notes '版本说明'
./scripts/verify-update-release.ps1
```

安装包输出：`src-tauri/target/release/bundle/nsis/客户工作台_<版本>_x64-setup.exe`；本地发布文件放在 `release/update/`，包含 `latest.json`、英文名安装包及 `.sig`。先确认所有测试通过，再人工审查版本说明、签名与安装包。校验脚本通过离线 Rust 工具对原文件进行完整签名验证，拒绝篡改文件或与当前公钥不匹配的签名。

只有明确要发布时才运行 `scripts/publish-github-update.ps1 -Repository 'moshangqingchen/Customer-Management-Dashboard' -Version '<版本>' -Notes '<说明>'`。该命令会创建或更新草稿、上传已校验的资源，最后公开发布；拒绝替换已经公开的同版本发布。需要 GitHub CLI 登录或 Git Credential Manager 中的凭据。

普通验证可运行 `npm.cmd run tauri build`。若未提供更新签名私钥，CLI 会在打包后提示无法签名；可用临时配置 `{"bundle":{"createUpdaterArtifacts":false}}`，通过 `npm.cmd run tauri build -- --config '<临时配置文件>'` 验证无签名安装包。不要将关闭签名的配置用于正式发布。

桌面应用启动十秒后静默检查一次，有新版本在侧栏设置旁提示。也可在关于中手动检查，查看版本说明，确认后下载、安装并重启。检查和下载均显式指定上述代理；浏览器预览不会请求更新。更新不涉及旧版数据迁移。
