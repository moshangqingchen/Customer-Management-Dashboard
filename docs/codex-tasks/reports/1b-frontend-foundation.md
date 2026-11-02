## 完成

- 已接续完成任务 1b 的前端实现，保留合格的现有工程与组件，未修改 `src-tauri/`、`docs/spec/`，未执行 git commit / push / 切分支 / reset。
- 工程为 Vite 6、React 19、TypeScript strict、Tailwind v4、本地 Inter Variable，包含全部指定 scripts 与依赖。浅色、深色、跟随系统主题以及暖纸·朱印 token、动画、滚动条均已接线。
- 应用外壳、侧栏真实计数、标签导航、历史栈、Alt+方向键、鼠标侧键、主题与视图偏好持久化、首次启动、新建客户/项目、命令面板、七个业务占位页及仅开发可用的设计系统展示页均已实现。
- API 的 61 个方法及 invoke 名称/参数已和 ARCHITECTURE §5–§6、后端报告核对。Mock 包含全量方法、持久化、软删除/恢复/合并/自动动态/状态日期/备份规则、14 客户、32 项目、40 笔收退款、10 标签、60+ 动态、3 组 12 条话术及 8 张代码 SVG 示例海报。
- 补齐 Mock 与后端的最近动态排序、收款默认方式与记忆、收款修改行为、完成日期、项目更换客户后的动态归属等差异。补齐缓存失效、状态日期乐观更新、文件拖放监听清理、中文输入保护、辅助标签、表格焦点与撤销失败提示。
- 修复切换收款项目时沿用上一项目表单的问题；`window.__mock.reset()` 现在会立即重查页面数据并回到首次启动流程。主要新建与设置文件库操作使用朱红主按钮。
- 修复生产分包中的隐性静态依赖：Mock 现为真正懒加载，主入口静态依赖图和 HTML preload 均不包含 Mock，生产构建不包含设计系统展示页。

组件清单：

- Button、IconButton、Input、Textarea、NumberInput、DateInput、InlineEdit、Select、Combobox、TagPicker。
- StatusPill、StatusSelect、TagPill、PaymentBadge、DueChip、Avatar、Money、ProgressBar。
- Card、Section、Table、Kanban、SidePanel、Dialog、ConfirmDialog、DropdownMenu、ContextMenu、Tooltip、Tabs、ToastProvider、undoToast。
- EmptyState、Skeleton、CopyButton、FileTile、FileRow、Kbd；七种空状态插画：今天无急事、无项目、无客户、无文件、无话术、搜索无结果、文件库离线。
- AppShell、Sidebar、PageHeader、Brand、CommandPalette、EntityPreview、NewProjectDialog、NewClientDialog、PaymentQuickForm、Onboarding、PlaceholderPage、DesignSystemPage。

Api 方法清单（共 61 个，均有 invoke 契约测试）：

| 命名空间 | 方法 |
|---|---|
| `app` | `info`、`saveTextFile` |
| `library` | `status`、`setRoot`、`openRoot`、`pickFolder` |
| `clients` | `list`、`get`、`create`、`update`、`delete`、`setTags` |
| `projects` | `list`、`get`、`create`、`update`、`setStatus`、`duplicate`、`delete`、`setTags` |
| `payments` | `list`、`all`、`add`、`update`、`delete` |
| `tags` | `list`、`create`、`update`、`delete`、`merge` |
| `activities` | `list`、`recent`、`addNote`、`updateNote`、`delete` |
| `files` | `list`、`recent`、`add`、`pickAndAdd`、`open`、`reveal`、`rename`、`trash`、`openFolder` |
| `snippetGroups` | `list`、`create`、`update`、`delete` |
| `snippets` | `list`、`create`、`update`、`delete`、`markUsed` |
| `settings` | `get`、`update` |
| `backups` | `list`、`create`、`restore` |
| `trash` | `list`、`restore`、`purge` |

## 未完成 / 偏离规格

- 真实浏览器的视觉与控制台手检未完成。浏览器连接宿主不可用；原生电脑控制工具先遇到最小化窗口，随后因无法可靠识别 Edge 当前网址而停止本轮 UI 操作。不能据此宣称真实浏览器控制台已人工验收或任务全部验收通过。dev 启动、HTTP 模块加载、应用 DOM 渲染与交互测试均已通过，具体证据见下方。
- 示例图遵循任务 1b 的明确要求使用 8 张代码 SVG；ARCHITECTURE §7 仍写 WebP，按本任务要求处理。未改变 §3–§6 接口契约。

## 验证

以下在仓库根目录执行。最终 `npm.cmd test` 与 `npm.cmd run build` 的退出码均为 `0`。

| 命令 | 结果 |
|---|---|
| `npm.cmd install --no-audit --no-fund` | `up to date in 526ms`；本次安装进程显式使用现有 `http://127.0.0.1:10090` 代理配置 |
| `npm.cmd test` | 9 个测试文件、159 项测试全部通过，原始汇总如下 |
| `npm.cmd run build` | TypeScript 检查与 Vite 构建通过，原始构建结果如下 |
| `npm.cmd run dev` | `VITE v6.4.5 ready in 1403 ms`，地址 `http://127.0.0.1:1420/`，终端未出现编译错误；HTTP 自查见下方 |

`npm.cmd test` 原始结果：

```text
 ✓ src/components/ui/interaction.test.tsx (11 tests) 1102ms
 ✓ src/hooks/hooks.test.tsx (11 tests) 495ms
 ✓ src/App.integration.test.tsx (3 tests) 2694ms
   ✓ 基础工作台完整流程 > 首次选择文件库后进入工作台，页面快捷键和导航历史互通且无渲染错误  934ms
   ✓ 基础工作台完整流程 > 客户支持保存并继续；项目可创建客户并回车保存，中文候选回车不提交  1255ms
   ✓ 基础工作台完整流程 > 命令面板回车复制话术并保留换行，选择收款项目时表单随项目重置  505ms
 ✓ src/api/mock/mock.test.ts (32 tests) 141ms
 ✓ src/hooks/file-drop.native.test.tsx (2 tests) 230ms
 ✓ src/lib/core.test.ts (34 tests) 19ms
 ✓ src/hooks/file-drop.test.tsx (2 tests) 86ms
 ✓ src/api/tauri.test.ts (61 tests) 10ms
 ✓ src/stores/stores.test.ts (3 tests) 8ms

 Test Files  9 passed (9)
      Tests  159 passed (159)
   Start at  03:32:15
   Duration  18.65s (transform 472ms, setup 1.01s, collect 10.32s, tests 4.79s, environment 3.31s, prepare 499ms)
```

`npm.cmd run build` 原始结果：

```text
vite v6.4.5 building for production...
transforming...
✓ 2602 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                              0.95 kB │ gzip:  0.55 kB
dist/assets/inter-vietnamese-wght-normal-CBcvBZtf.woff2     10.25 kB
dist/assets/inter-greek-ext-wght-normal-DlzME5K_.woff2      11.23 kB
dist/assets/inter-cyrillic-wght-normal-DqGufNeO.woff2       18.75 kB
dist/assets/inter-greek-wght-normal-CkhJZR-_.woff2          19.00 kB
dist/assets/inter-cyrillic-ext-wght-normal-BOeWTOD4.woff2   25.96 kB
dist/assets/inter-latin-wght-normal-Dx4kXJAl.woff2          48.26 kB
dist/assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2      85.07 kB
dist/assets/index-D0KodWtV.css                              37.48 kB │ gzip:  8.60 kB
dist/assets/files-BkNgPi3B.js                                0.71 kB │ gzip:  0.47 kB
dist/assets/core-Cre-Ek2L.js                                 0.83 kB │ gzip:  0.46 kB
dist/assets/tauri-DbXuIw77.js                                2.70 kB │ gzip:  0.84 kB
dist/assets/webview-Ultb-Gdd.js                             17.69 kB │ gzip:  3.94 kB
dist/assets/floating-ui.dom-CQWPtjkG.js                     23.21 kB │ gzip:  9.24 kB
dist/assets/mock-DIpaVVOm.js                                32.95 kB │ gzip: 12.04 kB
dist/assets/react-vendor-CSvC0xOB.js                       223.00 kB │ gzip: 69.35 kB
dist/assets/index-CwliYNXO.js                              303.00 kB │ gzip: 93.98 kB
✓ built in 8.25s
```

主 chunk 为 `index-CwliYNXO.js`，303.00 kB，gzip 93.98 kB；Mock 为 `mock-DIpaVVOm.js`，32.95 kB，gzip 12.04 kB。使用已安装的 `es-module-lexer` 递归检查构建后的静态 import 图，并检查 HTML preload，返回：

```text
Entry: index-CwliYNXO.js
Static graph: index-CwliYNXO.js, react-vendor-CSvC0xOB.js, floating-ui.dom-CQWPtjkG.js
Mock is lazy: true
Production design-system absent: true
```

dev 使用 `curl.exe --max-time 15 --silent --show-error --output NUL --write-out ...` 请求本机回环地址，退出码 `0`，原始结果：

```text
200 / (948 bytes)
200 /src/main.tsx (4144 bytes)
200 /src/App.tsx (15438 bytes)
200 /src/pages/DesignSystemPage.tsx (78148 bytes)
200 /src/styles/globals.css (50426 bytes)
200 /src/api/mock/index.ts (30255 bytes)
```

应用集成测试在 jsdom 中执行真实 App 与 Mock 流程，包含 `console.error` 未调用断言；该证据不等同于真实浏览器控制台手检。dev 已用 Ctrl+C 关闭，随后检查监听端口，返回：

```text
Port 1420: no listener
```

静态检查：`src/**/*.tsx` 无超过 300 行组件文件；`src/**/*.ts(x)` 无 `any`。未重新运行后端构建，也未更改后端文件。

## 给 Claude 的备注

- 下一阶段沿用 `hooks/queries.ts` 的 query keys 与 mutation，状态/星标乐观更新及文件缓存刷新已备好；七个业务页仍按 1b 要求展示「下一阶段实现」，EntityPreview 是最小详情承接组件。
- 先补真实浏览器的浅/深色视觉与控制台复验；开发模式通过 Ctrl+K →「设计系统」查看组件、看板、文件、全部颜色 token 与七种插画。`window.__mock.reset()` 可恢复种子并立即刷新首次启动状态。
- 收入纯函数目前口径：实收按 `paidAt`；成本、成交数与待收按项目 `createdAt` 所属周期；cancelled 排除，lead 不计成交，客单价为成交项目平均报价。规格未细化的统计归属周期请在业务页面阶段统一确认。
- 后端报告提到的 `lastActivityAt` 差异已修复；文件夹重命名失败 warning 已转为中文提示。61 条 invoke 契约测试覆盖的是前端传参，本轮未人工验收桌面原生文件对话框与资源管理器。
- 本轮无新增依赖；沿用工程已有的 `@testing-library/user-event` 测试辅助依赖。规格文件、后端及原有 git 暂存状态均保留。
