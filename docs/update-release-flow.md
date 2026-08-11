# 应用更新发布流程

应用已经接入 Tauri Updater：

- 启动后自动检查一次更新。
- “设置”页可以手动点击“检查更新”。
- 有新版本时显示版本号和更新内容。
- 用户可以选择“取消此次更新”或“更新并重启”。
- 下载并安装成功后自动重启，客户、订单和文件库数据不会被删除。

## 更新源

安装包必须预先写入一个长期有效的 HTTPS 更新地址。推荐单独创建一个公开的 GitHub 仓库，只存放安装包、签名和 `latest.json`，不要上传客户数据或签名私钥。

当前安装包使用下面的公开更新清单：

```text
https://github.com/moshangqingchen/Customer-Management-Dashboard/releases/latest/download/latest.json
```

如需迁移到另一个发布仓库，发布脚本会把新地址同步写入安装包配置。发布仓库必须公开，且只能存放安装包、签名和 `latest.json`，不得上传客户数据或签名私钥。

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
5. 创建 Draft GitHub Release，先上传安装包和签名，最后上传 `latest.json`。
6. 所有资源上传成功后再发布 Release 并设为 latest。若任一步骤失败，Release 会保持 Draft，客户端不会看到半成品更新。

上传前还会自动运行 `update:verify`，只要存在占位地址、版本号不一致、缺少权限、安装包哈希不一致或签名不一致，发布就会停止。为避免替换正在被客户端读取的资源，脚本不会覆盖已经发布的同版本 Release；需要修复发布内容时应增加版本号。

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

构建脚本优先读取环境变量 `TAURI_SIGNING_PRIVATE_KEY` 与 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`；未提供私钥环境变量时才读取本机私钥文件。加密私钥应通过安全的 CI Secret 或当前终端环境变量传入密码，不要把密码写进脚本或仓库。
