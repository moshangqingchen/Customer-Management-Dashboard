## 完成

- 已将当前工作区功能打包为 **2.3.0**，用 NSIS `/S /UPDATE` 覆盖升级到原安装目录 `D:\project development\创业客户管理工作台\app`。未调用旧卸载程序，未清空应用数据。
- 最终版本已启动并保持窗口打开，供用户体验。桌面与开始菜单「客户工作台」快捷方式仍指向原目录的 `client-desk.exe`。
- 升级前完整备份并逐文件校验了原程序、应用数据与客户资料库：483 个文件，145,395,781 字节；另保存 SQLite 一致快照、逐文件 SHA256 和业务表摘要。
- 升级备份：`D:\project development\创业客户管理工作台\我的数据\升级备份\2.3.0-升级前-20261105-201625`。
- 保留原 `portable.json`，应用数据仍在 `我的数据\应用数据`，文件库仍在 `我的数据\客户资料库`。首次启动完成 schema 1 → 2 迁移。
- 安装前、安装后、启动后均核对原业务表内容摘要。客户 2 条、项目 2 条、动态 13 条及标签／关联／设置等保持一致；客户和项目各包含 1 条原有回收站记录。没有恢复、删除、归档或合并用户的任何记录。
- 文件库内升级前已有的 24 个文件全部 SHA256 一致；原生文件页正常显示 17 个日常文件，原备份等内部文件仍在原位置。
- 同步 package、npm lock、Cargo、Cargo lock、Tauri 版本到 2.3.0。修复演示版和 AppInfo 测试写死旧版本的问题，分别改为读取 package 版本和 `CARGO_PKG_VERSION`。

## 未完成 / 偏离规格

- 无。本次只安装本机，未发布 GitHub Release 或更改线上更新清单。

## 验证

- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-tauri-signed.ps1`（`CARGO_NET_OFFLINE=true`）→ 最终退出码 0，原始日志 `.cache/deploy-2.3.0/build-final.log`：

```text
✓ built in 4.04s
    Finished `release` profile [optimized] target(s) in 34.90s
    Finished 1 bundle at:
        D:\project development\创业客户管理工作台\src-tauri\target\release\bundle\nsis\客户工作台_2.3.0_x64-setup.exe (6.04 MiB)
    Finished 1 updater signature at:
        D:\project development\创业客户管理工作台\src-tauri\target\release\bundle\nsis\客户工作台_2.3.0_x64-setup.exe.sig
```

- `cargo run --manifest-path src-tauri/Cargo.toml --example verify_update --offline -- <安装包> <签名> src-tauri/updater-private.key.pub` → 退出码 0：`安装包与更新公钥的完整签名验证通过。`
- 最终 NSIS `/S /UPDATE /D=<原app目录>` → `ExitCode=0`；注册表 `DisplayVersion=2.3.0`。
- 最终安装包 6,337,232 字节；SHA256：`CF856DD22DC707326633DA749D625D250CF6DA1211014BC8B8BA34B5073E0748`；更新签名 448 字节。
- 安装后主程序 SHA256：`399CAE99F9E568BE06AC0FA36D50C449FD9D115DD74F2DF2F6E300C3E9D433DA`。已对整文件核对：与 release 构建仅相差 Tauri 预期的 bundle 标记 `UNK → NSS`；还原该标记后逐字节相同。首次直接比较 SHA256 因此标记差异被中止核验，查明后按正确规则验证通过，未覆盖程序文件绕过安装器。
- `python .cache/deploy-2.3.0/verify-data.py after-start` → 退出码 0：`schema=2`、`integrity=ok`、`foreignKeys=ok`、`originalLibraryFilesVerified=24`、`portableConfigUnchanged=true`、`libraryRootUnchanged=true`；原业务表内容摘要全部一致。仅自动备份日期允许由启动逻辑更新。
- `npm.cmd test -- src/api/mock/mock.test.ts src/pages/PortableData.test.tsx` → 退出码 0：

```text
 Test Files  2 passed (2)
      Tests  45 passed (45)
   Duration  14.21s (transform 479ms, setup 226ms, collect 4.66s, tests 908ms, environment 751ms, prepare 107ms)
```

- `cargo test --offline --lib commands::tests::app_info_reports_standard_and_portable_data_locations` → 退出码 0：`test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 25 filtered out; finished in 0.05s`。
- 功能全量验证沿用本会话报告 8 的前端 413 项、Rust 87 项通过结果；本次只新增版本同步并做上述定向验证、生产构建与原生实测。
- 原生界面实测：关于页显示 2.3.0 与原数据目录，客户跟进入口可打开，文件库显示原缩略图及「版本与恢复」入口，最终程序重新启动后今日页与最近动态正常显示。只读查看，没有提交业务表单。

## 给 Claude 的备注

- 本机完整安装与备份已经完成，无需用户再手动覆盖 exe。最终主程序进程由原 app 目录启动。
- 最终安装包和 `.sig` 位于 `src-tauri/target/release/bundle/nsis/`，未上传。更新签名是 Tauri 更新包签名，不等同于 Windows Authenticode 证书签名。
- 便携配置、客户文件、原回收站和应用偏好均保留。若需要回退旧程序，应使用本次升级前的配套数据库备份，不能让 schema 1 程序直接打开 schema 2 数据库。
- 已核对生成的 NSIS：`/UPDATE` 跳过旧卸载及 WebView2 下载，非更新且勾选删除应用数据的分支未执行。本机已有 WebView2 156.0.4314.58。
- 构建使用已有代理与离线 Cargo 缓存；启动进程的 HTTP(S) 及 WebView2 请求配置为 `http://127.0.0.1:10090`，更新检查本身也显式指定该代理；未更改全局网络设置，未声称系统级强制阻断。
- 详细验证记录保存在忽略目录 `.cache/deploy-2.3.0/`；备份与真实数据仍属于忽略目录「我的数据」。未 commit / push / 切分支，未修改 `docs/spec/`。
