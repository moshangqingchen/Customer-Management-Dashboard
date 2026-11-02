# 任务 1b：前端基础（工程、设计系统、应用外壳、API 层与 Mock）

> **注意**：这个任务之前用命令行跑过一次，中途被中断。工作区里已经有部分文件（你的范围内）。先检查现有内容：合格的保留并继续，不合格的直接重写。不要因为文件已存在就以为已经完成。

先完整阅读 `AGENTS.md` 和 `docs/spec/` 下三份规格。你负责前端的**地基**；各业务页面的完整功能在下一阶段做，这一阶段要把地基打得非常扎实、好看。

## 你的范围（只能改这些）
- 仓库根目录的前端工程文件：`package.json`、`package-lock.json`、`index.html`、`vite.config.ts`、`vitest.config.ts`（或合并进 vite 配置）、`tsconfig*.json`、`src/**`、`public/**`（尽量不用）。
- **不要碰** `src-tauri/`（另一个 Codex 正在同时写 Rust 后端）、`docs/`、`.gitignore`、`scripts/`。

## 要做的
1. **工程**：Vite 6 + React 19 + TS strict；Tailwind v4（`@tailwindcss/vite`）；依赖按 ARCHITECTURE §1 安装（`npm.cmd install`）。npm scripts：`dev`（vite，端口 1420，strictPort）、`build`（tsc -b && vite build）、`test`（vitest run）、`test:watch`、`preview`、`tauri`。`@tauri-apps/api` v2、`@tauri-apps/cli` v2（dev）。
2. **设计 token 与全局样式**：`src/styles/tokens.css` 完整实现 DESIGN.md §2–§6 的浅色/深色两套变量（强调色用已选定的「暖纸·朱印」）；`globals.css` 用 `@theme inline` 把 token 映射为 Tailwind 工具类（例如 `bg-surface`、`bg-subtle`、`text-fg-2`、`border-line`、`bg-accent`、`text-accent`…），之后所有组件只用这些工具类。主题通过 `<html data-theme>` 切换，支持跟随系统。字体按 §4（`@fontsource-variable/inter`）。自定义滚动条细且低调。
3. **设计系统组件**（`src/components/ui/`）：DESIGN.md §7 列出的全部组件，基于 Radix。质量要求：键盘可用、焦点环清晰、aria 完整、两套主题都好看。`InlineEdit`、`NumberInput`（金额：输入元，内部存分）、`DateInput`（带快捷选项和 date-fns 中文）、`Combobox`（支持「创建 "xxx"」）、`TagPicker`（搜索 + 勾选 + 新建并选色）、`StatusSelect`、`DueChip`、`Money`、`Avatar`、`CopyButton`、`SidePanel`（可拖宽、Esc 关闭）、`EmptyState`、`Skeleton`、`Kbd`、Toast（sonner，含撤销动作）都要做好。
4. **空状态插画**（`src/components/illustrations/`）：DESIGN.md §8 列出的 7 个，手写 SVG，统一线条风格，`currentColor` + 一处强调色，两套主题下都好看。
5. **API 层**：`src/api/types.ts`（逐字照搬 ARCHITECTURE §5）、`src/api/client.ts`（`Api` 接口，方法与 §6 命令一一对应，用分组命名空间如 `api.projects.list()`；运行时选择实现；错误统一转成带 `code` 的 `ApiError`）、`src/api/tauri.ts`（invoke 实现，命令名与参数严格按 §6）、`src/api/mock/`（§7 的完整 Mock：全部方法、业务规则、localStorage 持久化、`window.__mock.reset()`、真实感种子数据、日期相对今天生成）。Mock 的示例设计图用**代码生成的 SVG 海报构图**（抽象色块/几何/假文字条，8 张，风格各异），不要用 AI 生图。Mock 必须是生产构建中独立的懒加载 chunk。
6. **纯函数库**（`src/lib/`）+ 单元测试：money（格式化、解析、收款状态、待收、利润）、dates（today 可注入、相对日期中文、逾期/即将到期判断、快捷日期）、status（状态元数据：标签、颜色 token、看板列）、colors（标签调色板、头像配色 hash）、files（类型判断、大小格式化、中间省略文件名）、stats（收入统计：按周期汇总实收/待收/成本/利润/成交数/客单价、按月序列、客户排行，含退款与 cancelled 规则）、filters（项目筛选与排序、客户搜索与排序）、search（命令面板模糊匹配，支持拼音首字母可选——不做也行，但要支持中文子串和忽略大小写）。
7. **数据 hooks**：`src/hooks/queries.ts` 覆盖所有实体的查询与 mutation，query key 规范，mutation 成功后精确失效；状态/星标乐观更新。`useHotkeys`、`useCopy`、`useFileDrop`（Tauri：onDragDropEvent + elementFromPoint 找 `[data-drop-target]` + 悬停高亮；浏览器：HTML5 drop 事件交给 mock）。
8. **应用外壳**：`AppShell`（侧栏 + 主区；主区内页面切换有轻微过渡）；`Sidebar`（PRODUCT §6 的完整结构，视图计数与标签计数来自真实数据，可折叠为图标栏，文件库状态点）；`stores/nav.ts`（页面 + 参数 + 历史栈，Alt+←/→ 和鼠标侧键前进后退）；`stores/ui.ts`（主题、侧栏折叠、面板宽度、视图偏好，持久化）；`PageHeader`。
9. **命令面板**（cmdk，Ctrl+K）：分组搜索客户、项目、话术（回车复制）、命令（新建项目、新建客户、跳转各页、切换主题、打开文件库）。
10. **新建项目弹窗**（Ctrl+N）与**新建客户弹窗**（Ctrl+Shift+N）：按 PRODUCT §9 完整实现（客户下拉可直接创建新客户、截止日快捷选项、Ctrl+Enter 保存并继续）。
11. **首次启动页**（PRODUCT §7.9）：未设置文件库时显示。
12. **页面占位**：今日/项目/客户/收入/文件/话术/设置 先各做一个带 `PageHeader` 的占位页（标题 + 一句「下一阶段实现」+ 对应空状态插画），路由与侧栏联通。
13. **设计系统展示页**（仅开发模式）：命令面板里「设计系统」可打开，展示全部组件、状态、插画、颜色 token，浅/深色切换。Claude 会用它验收。

## 验证（全部通过才算完成，结果原样写进交付说明）
- `npm.cmd test`
- `npm.cmd run build`（确认产物中 mock 是独立 chunk，写明 chunk 名与主 chunk 大小）
- 启动 `npm.cmd run dev` 确认能起来、无控制台错误后**关掉它**，不要留下常驻进程。

最后按 AGENTS.md 的格式写交付说明，并列出：组件清单、Api 方法清单、你认为下一阶段需要注意的点。

## 交付方式
完成后，除了在对话里回复，还要把同样的交付说明写入 `docs/codex-tasks/reports/1b-frontend-foundation.md`（Claude 通过这个文件得知你已完成）。只有全部验证跑完才写这个文件。
