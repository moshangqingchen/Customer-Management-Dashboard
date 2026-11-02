# 任务 2a：「晴空」换皮 + 今日页 + 首次启动页

先读 `AGENTS.md`，再**完整重读** `docs/spec/DESIGN.md`（已整体改为方向 A「晴空」）、`docs/spec/PRODUCT.md` §7.1/§7.9、`docs/spec/ARCHITECTURE.md`（Project 新增 `coverPath`）。视觉基准：`docs/spec/concepts/v2/A-today.png`（今日页）、`docs/spec/concepts/v2/A-projects.png`（项目看板，本任务只用来对齐组件风格）。

## 背景
第一阶段的前端地基（`src/`）功能完整，但用户看了说「ui太丑了，我要年轻化的」，要「比参考更好看更大气」。用户已选定「晴空」方向。本任务把整个前端换成新视觉，并完整实现今日页。**功能逻辑、hooks、API、Mock 行为保持不变**，只改视觉与新增页面。

## 你的范围
- `src/**`（代码）、根目录前端配置；
- 后端 `src-tauri/src/**` 与 `src-tauri/tests/**` 中**仅限** `coverPath` 字段相关的改动；
- `src-tauri/icons/`（应用图标）。
- 另一个 Codex 对话正在**同时**生成插画素材，写入 `src/assets/illustrations/*.webp` 与 `src/api/mock/assets/*.webp`（文件清单见 `docs/codex-tasks/0c-illustrations.md`）。**不要自己创建这些同名文件**；按文件名引用它们。若你需要时文件还不存在，先做其余工作，最后再检查（每隔 1 分钟检查一次，最多等 40 分钟）；超时仍缺的，在交付说明里列出，并确保缺图时界面有优雅降级（例如淡彩渐变占位），构建不能因缺图失败（用 `import.meta.glob` 按名取图即可做到）。

## 要做的
1. **Token 与全局样式**：按 DESIGN.md §2–§6 重写 `src/styles/tokens.css` 与 Tailwind 映射（浅/深两套），加入背景光斑、主渐变、彩色阴影、新圆角与字号阶梯。Tailwind 只扫描 `src/` 与 `index.html`（在 globals.css 用 `@import "tailwindcss" source(none);` + `@source "../";` 之类的方式），修复当前 dev 首次加载 Tailwind 编译需要约 20 秒的问题，并在交付说明里写出修复前后耗时。
2. **组件换皮**：`src/components/ui/` 全部组件按 DESIGN.md §7 改造；新增 `IconTile`、`StatCard`、`HeroBanner`。Tabs 改为胶囊分段式；Table 行高 48 与选中行渐变指示条；Toast 白卡片 + 图标块；Skeleton 微光。
3. **外壳**：悬浮白色侧栏（距边 12、圆角 20、阴影），应用标志 + 「客户工作台」+ 小字「每一单，都被好好照顾」；快速搜索框；导航选中态（`--primary-soft` 底 + 左侧 3px 渐变条 + 主色文字）；视图计数红色小胶囊；标签彩色圆点；底部「文件库已连接」淡绿状态卡片（离线时变淡红）+ 设置 + 浅/深色切换分段按钮。主区背景光斑。页面切换动效。参照 A-today.png 左侧。
4. **应用标志**：按 DESIGN.md §5.4 用 SVG 精确绘制蓝紫渐变文件夹对勾标志 → `src-tauri/icons/app-icon.svg` + 16/32px 简化版 `app-icon-small.svg`；本地矢量光栅化导出 1024 PNG，`npx.cmd tauri icon` 生成全套覆盖旧图标（ico 的 16/32 层用简化版）；生成 `docs/spec/concepts/icons/preview.png`（16/32/64/256 并排）。侧栏与首次启动页使用同一 React SVG 组件。
5. **今日页**（PRODUCT §7.1 + DESIGN §5.1/§5.2，对齐 A-today.png）：
   - HeroBanner：时段插画（hero-morning/afternoon/night，深色主题恒用 night），问候 + 每日轮换一句话、数据总结、渐变「新建项目」+「查看全部项目 →」；首次使用（0 项目）时显示欢迎引导文案与「新建第一个客户」。
   - 4 张 StatCard：进行中、本周到期、待收款、本月收入（含环比），可点击跳到项目页对应筛选或收入页。
   - 左栏「需要关注」（逾期在前 + 3 天内到期，行内：头像、项目名、客户、状态 pill、DueChip、金额；点击打开项目详情）与「进行中」按状态分组紧凑列表（有 `coverPath` 的显示 44px 圆角缩略图，否则显示客户头像；行内可下拉改状态）。
   - 右栏「本月收入」卡（大数字 + 环比 + 近 6 月柱状图，当月柱主渐变，其余 `--primary-soft`，自定义 tooltip）、「待收款」前 5（行尾「记一笔」打开 PaymentQuickForm）、「最近动态」时间线（彩色小图标块 + 文本 + 相对时间）。
   - 窗口 1100×700 最小尺寸下布局不溢出（右栏可下移）。
6. **首次启动页**：左右分栏或居中大卡片，`welcome.webp` 插画 + 标志 + 大标题 + 文件库选择，整体与晴空风格一致。
7. **空状态**：`EmptyState` 改用吉祥物位图（`empty-*.webp`、`library-offline.webp`），深色主题加柔光圆底；替换所有旧 SVG 空状态插画的使用处（旧 SVG 组件可删除）。
8. **Project.coverPath**（契约已更新）：后端在计算 fileCount 的同一次扫描里取最近修改的图片路径，同一缓存与失效规则；`models.rs`、序列化、相关测试；前端 `types.ts`、Mock（Mock 项目按种子分配 `src/api/mock/assets/` 中的示例图 URL，约 60% 项目有封面）、`tauri.ts`。缩略图显示用 `convertFileSrc`（Mock 下直接用 URL）。
9. **设计系统展示页**同步更新，展示新组件与全部 token、插画（缺图时显示占位）。
10. 其他业务页（项目/客户/收入/文件/话术/设置）本任务仍是占位，但占位页要用新风格（PageHeader 大标题 + 吉祥物空状态），不能看起来是坏的。

## 质量要求
- 截图级对齐 A-today.png：比例、留白、圆角、阴影、配色、字号层级。两套主题都要好看（深色主题参考 DESIGN.md 深色 token）。
- 已有的 159 个前端测试保持通过（视觉改动导致的快照/选择器变化可调整测试，但不能删掉行为断言）；为今日页的数据派生（需要关注排序、本周到期、环比）补单测。
- 后端 `cargo fmt --check`、`clippy -D warnings`、`cargo test` 通过。

## 验证（结果原样写进交付说明）
- `npm.cmd test`、`npm.cmd run build`
- `src-tauri` 下 `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`
- `npm.cmd run dev` 冷启动首屏可交互耗时（修复前后对比），确认后关闭。

## 交付方式
对话回复交付说明，同时写入 `docs/codex-tasks/reports/2a-reskin-today.md`。
