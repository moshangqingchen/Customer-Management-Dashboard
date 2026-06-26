# 应用更新发布流程

应用已经接入 Tauri Updater：

- 启动后自动检查一次更新。
- 顶栏可以手动点击“检查更新”。
- 有新版本时显示版本号和更新内容。
- 用户可以选择“取消此次更新”或“更新并重启”。
- 下载并安装成功后自动重启，客户、订单和文件库数据不会被删除。

## 首次接通更新源

安装包必须预先写入一个长期有效的 HTTPS 更新地址。推荐单独创建一个公开的 GitHub 仓库，只存放安装包、签名和 `latest.json`，不要上传客户数据或签名私钥。

当前 `src-tauri/tauri.conf.json` 仍使用占位地址。确定仓库后，首次发布脚本会将其替换为：

```text
https://github.com/OWNER/REPOSITORY/releases/latest/download/latest.json
```

本机需要先登录 GitHub。脚本会优先使用 GitHub CLI；没有安装 GitHub CLI 时，会自动使用 Windows 中保存的 Git Credential Manager 凭据。

```powershell
gh auth login
```

## 发布新版本

例如发布 `1.1.0`：

```powershell
npm.cmd run update:publish:github -- `
  -Repository "OWNER/REPOSITORY" `
  -Version "1.1.0" `
  -Notes "新增更新提醒`n修复订单文件刷新"
```

脚本会自动完成：

1. 同步 `package.json`、`package-lock.json`、`Cargo.toml` 和 `tauri.conf.json` 的版本号。
2. 写入 GitHub Release 的固定更新清单地址。
3. 使用本机私钥构建并签名 Windows 安装包。
4. 生成 `latest.json`，其中包含版本号、更新内容、下载地址和签名。
5. 创建或更新 GitHub Release，并上传清单、安装包和签名。

上传前还会自动运行 `update:verify`，只要存在占位地址、版本号不一致、缺少权限、安装包哈希不一致或签名不一致，发布就会停止。

已经安装旧版本的电脑会在下次打开软件时发现新版本。

## 仅生成本地发布文件

```powershell
npm.cmd run tauri:build:signed
npm.cmd run update:manifest -- `
  -DownloadUrl "https://example.com/startup-customer-workbench-1.1.0-x64-setup.exe" `
  -Notes "本次更新内容"
```

生成结果位于 `release/update/`。

## 签名密钥

- 私钥：`src-tauri/updater-private.key`
- 公钥：`src-tauri/updater-private.key.pub`

私钥已加入 `.gitignore`。不要上传、分享或删除它；以后所有版本必须继续使用同一把私钥签名，否则旧版应用不会信任新安装包。
