# 任务 3：今日、收入、文件、话术、设置、图标、更新与发布

先完整阅读 `AGENTS.md`、`docs/spec/` 三份规格，通读现有 `src/` 与 `src-tauri/`（前两个阶段已完成地基、后端、项目/客户/标签/文件/收款/动态）。复用已有组件与 hooks。

## 你的范围
`src/**`、`src-tauri/**`（除 `updater-private.key*` 与 `target/`）、`scripts/**`、`README.md`、`.gitignore`。不要改 `docs/spec/`。

**视觉**：全部页面使用「晴空」方向（`docs/spec/DESIGN.md`），与已完成的今日页、项目页风格一致（参考 `docs/spec/concepts/v2/A-today.png`、`A-projects.png`）：大标题、StatCard、IconTile、白色大圆角卡片、渐变主按钮、吉祥物空状态。今日页、应用图标已在 2a 完成，不要重做。

## 前端
1. （今日页已在 2a 完成，只做走查修正。）
2. **收入 §7.5**：时间范围切换、6 个指标卡含环比、recharts 12 月柱状 + 利润折线（自定义 tooltip、token 配色、深色主题适配）、待收款表、收款流水（方式筛选、退款红色负数、导出 CSV 走 `save_text_file`）、客户排行。所有数字来自 `lib/stats.ts`。
3. **文件 §7.6**：全库最近文件，网格/列表、类型筛选、客户筛选、文件名搜索、右键菜单（打开/显示/复制路径/跳到项目）。
4. **话术 §7.7**：分组管理（新建/重命名/拖拽排序/删除确认）、卡片网格、点击复制并 `snippet_mark_used`、悬停编辑删除、跨组搜索、编辑弹窗。
5. **设置 §7.8**：文件库（状态、可用空间、打开、更换位置）、子文件夹模板编辑、外观（主题、侧栏紧凑）、标签管理（改名、改色、合并、删除确认）、收款方式与来源平台管理（增删拖拽排序）、备份（列表、立即备份、恢复确认 → 恢复后全量刷新）、回收站（恢复、彻底删除确认）、关于（版本、检查更新）。
6. **打磨**：全应用走查一遍——空状态、骨架、错误处理、键盘快捷键（Ctrl+1..6、Ctrl+K、Ctrl+N、Ctrl+Shift+N、/、Esc）、焦点管理、两套主题对比度、窗口最小尺寸 1100×700 下无溢出、长文本省略。修掉你发现的所有问题并列出。

## 2b 验收发现的问题（必须修）
1. **项目默认排序**：「按截止日」升序把早已完成的旧项目排在最前。改为默认「智能排序」：未结项目（lead/active/review/delivered）在前，按截止日升序（无截止日的排在未结末尾）；已完成/已取消在后，按完成/更新时间倒序。排序菜单保留其余选项。
2. **Mock 种子日期**：截止日全是「每月 12 日」，一眼假。改为相对今天的自然分布（-60 到 +30 天随机但确定性的偏移，未结项目多在近期，已完成项目集中在过去），更新时间同理；保证今日页和看板依旧有逾期/明天到期/本周到期样例。
3. **看板列宽自适应**：1440×900 窗口只显示 4 列，「已完成」需横向滚动。列宽改为在可用宽度内均分（最小 220px），可用宽度不足 5×220 时才横向滚动。
4. **标签重复显示**：项目详情与客户详情里，TagPicker 触发框内显示了一遍标签，下面又列了一遍胶囊。只保留一处（触发框内显示标签胶囊，点击打开选择器）。
5. **项目属性区像表单**：现在每个字段都是常驻输入框，视觉笨重。按 PRODUCT §9「一切可就地编辑」与 `docs/spec/concepts/v2/A-projects.png`/旧 `projects-light.png` 右侧面板：改为「图标 + 标签 + 值」两列清爽展示，悬停出现淡底，点击才变为输入控件，回车/失焦保存。客户详情的联系方式与公司名同理。
6. **非图片文件图块**：PSD/AI/PDF 等显示灰色通用图标。按 DESIGN §7 用对应淡彩 IconTile + 扩展名徽标：design（psd/ai/fig…）sky、pdf rose、doc violet、archive amber、video peach、other 灰。
7. **`npm run tauri dev` 实测**：devUrl 已改为 `http://127.0.0.1:1420`，Vite 绑定 127.0.0.1。启动 `npm.cmd run tauri dev` 确认窗口正常加载、无 CSP 拦截（必要时为开发模式配置 `devCsp` 放行 `ws://127.0.0.1:1420`）、HMR 生效，然后关闭。

## 应用图标
已在 2a 完成（`src-tauri/icons/app-icon.svg` 蓝紫渐变文件夹对勾）。只需确认安装包、任务栏、窗口标题栏图标都正确显示。

## 更新与发布
1. 接入 `tauri-plugin-updater` + `tauri-plugin-process`：pubkey 沿用旧版（从 `src-tauri/updater-private.key.pub` 读取内容填入 `tauri.conf.json`），endpoint `https://github.com/moshangqingchen/Customer-Management-Dashboard/releases/latest/download/latest.json`，`createUpdaterArtifacts: true`。前端：设置→关于里「检查更新」，有更新时弹窗显示版本与说明，确认后下载安装并重启；启动 10 秒后静默检查一次，有更新在侧栏底部显示小红点。
2. 更新 `scripts/*.ps1`：产品名、安装包文件名、版本号来源改为新项目（`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 三处版本同步）。不要执行任何发布/上传。
3. 重写 `README.md`（中文）：产品介绍、功能、文件库结构、备份说明、开发命令、发布流程。
4. 检查 `.gitignore` 适用于新工程。

## 验证（结果原样写进交付说明）
- `npm.cmd test`、`npm.cmd run build`
- `src-tauri` 下 `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`
- `npm.cmd run tauri build`（不签名也可以；若因缺少签名私钥环境变量失败，用 `-- --config` 临时关闭 `createUpdaterArtifacts` 再构建一次以验证安装包能产出），写明安装包路径与大小。

## 交付方式
完成后，除了在对话里回复，还要把同样的交付说明写入 `docs/codex-tasks/reports/3-rest-and-ship.md`（Claude 通过这个文件得知你已完成）。只有全部验证跑完才写这个文件。
