# 任务 2a：晴空换皮、今日页与首次启动页

## 完成

- 已完整阅读 AGENTS.md、PRODUCT.md、DESIGN.md、ARCHITECTURE.md 和任务说明；实现以方向 A「晴空」为视觉基准。
- 重写浅色/深色 token、字号阶梯、圆角、彩色阴影、背景光斑、主渐变和减弱动效；完成全部 UI 组件换皮，新增 IconTile、StatCard、HeroBanner 和位图插画组件。Tabs、Table、Toast、Skeleton、浮动详情面板均接入新样式。
- 完成悬浮侧栏、应用标志、快速搜索、视图计数、标签、文件库状态、浅深主题切换；保留快捷键、导航历史和现有弹窗行为。打开今日项目详情时主导航保持选中。
- 完成今日页：本地时段横幅、每日文案、零项目欢迎引导、四张统计卡及筛选跳转、关注项目排序、按状态分组的工作列表、行内状态切换、项目缩略图、本月净收入与环比、六个月收入图及自定义提示、待收前五和收款表单、最近十条动态。
- 完成首次启动页、其他业务占位页和设计系统展示页；全部 19 份并行任务插画/设计稿已到位并按约定文件名接入，缺图和加载失败仍有淡彩降级。本任务未生成或修改这些 WebP。
- 完成蓝紫文件夹对勾 SVG、16/32px 简化版、1024×1024 PNG 和 Tauri 图标套件；ICO 的 16/32 层使用简化版。预览：`docs/spec/concepts/icons/preview.png`。
- 完成 Project.coverPath 前后端与 Mock：后端与 fileCount 共用同次扫描、30 秒缓存和失效机制；选取递归最多 3 层、可见、≤25MB 的 png/jpg/jpeg/webp/gif 中最近修改的一张。Mock 新种子为 20/32 个项目分配封面，Tauri 图片通过 convertFileSrc 加载。
- Mock 的示例图身份在改名、移动文件夹、更换库位置和备份恢复后保持稳定；仅升级当前 v2 Mock 中可严格识别的预置 SVG 素材，保留客户、项目、收款、动态、自建文件及修改，不处理旧版真实应用数据。额外补齐封面的深度和隐藏文件筛选回归。
- 收入图独立懒加载，Mock 保留独立 chunk；没有新增依赖，没有 git commit/push/分支/reset 操作，没有修改规格正文。

## 未完成 / 偏离规格

- 实际浏览器截图、1100×700 和浅深主题的最终目视验收、真实首屏可交互耗时尚未完成。浏览器工具返回 `The browser access host is unavailable`；原生 Edge/资源管理器窗口返回 `window is minimized; call activate_window, refresh with get_window, then retry get_window_state`，当前可用接口没有提供恢复操作。已请求用户还原 Edge，未用其他 UI 自动化绕过。已完成布局代码审查、真实 App 的 jsdom 交互测试与插画/图标文件目视检查。
- 业务页按本任务要求保留占位；统计卡通过导航参数传递对应筛选，完整业务列表由后续任务实现。

## 验证

以下为已完成命令的输出摘录，保留原始结果行。

### npm.cmd test

```text
 Test Files  12 passed (12)
      Tests  181 passed (181)
   Duration  24.28s (transform 477ms, setup 2.26s, collect 16.87s, tests 8.05s, environment 3.72s, prepare 562ms)
```

原行为断言保留；新增今日派生测试和真实 App 交互测试，另补 coverPath 的 IPC、Mock 与文件边界测试。

### npm.cmd run build

```text
> tsc -b && vite build
✓ 3221 modules transformed.
dist/assets/index-BdNDB8j7.js                              330.60 kB │ gzip: 101.90 kB
dist/assets/TodayIncomeChart-BBAl1v1E.js                   367.45 kB │ gzip: 108.12 kB
✓ built in 4.14s
```

构建退出码 0；Mock 为独立懒加载文件；没有主 chunk 超限或 Tauri core 混合导入警告。

### src-tauri：cargo fmt --check

```text
exit code: 0
（无输出）
```

### src-tauri：cargo clippy --all-targets -- -D warnings

```text
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.11s
```

### src-tauri：cargo test

```text
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.73s
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.22s
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.14s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.85s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

共 35 项通过；Rust 命令设置进程内 `CARGO_NET_OFFLINE=true`，没有下载依赖。

### npm.cmd run dev 冷启动

| 指标 | 修复前 | 修复后 |
|---|---:|---:|
| Vite ready | 1325 ms | 1256 ms |
| 首次 `/src/styles/globals.css` HTTP 200 响应 | 5806 ms | 238 ms |
| 真实浏览器首屏可交互 | 工具故障，未取得 | 工具故障，未取得 |

测量方法：每次使用新启动的 `npm.cmd run dev` 进程，首次请求相同 localhost CSS 地址，以 PowerShell Stopwatch 计时。保留现有依赖缓存，不等同于全新安装依赖。任务描述的约 20 秒在初始基线中未复现，但中途仅限制 Tailwind 源、未限制 Vite 监视时曾测到 22447 ms。

最终修复包括：Tailwind `source(none)`，仅显式扫描 src 与 index.html；Vite `optimizeDeps.entries: ['index.html']`；文件监视忽略 src-tauri 和 docs。诊断确认 Vite 曾发现 src-tauri/target 中的旧生成 HTML，扩大 CSS 处理与监视开销；Tailwind 实际扫描约 27 ms。以上 CSS 响应数据不标作完整首屏 TTI。

验证结束后已关闭本任务的 1420 开发服务；诊断用 1421 服务与临时缓存也已清理。

## 给 Claude 的备注

- 无接口冲突、无新增依赖。只增加契约已规定的 coverPath 字段；导航增加 statuses/due 参数供统计卡预设筛选使用。
- 建议浏览器恢复后优先目视检查 1440×900、1100×700、浅深主题和首次启动页，并补记真实首屏可交互耗时。
- 插画生成参数、提示词和费用情况由并行素材任务记录在 `docs/codex-tasks/reports/0c-illustrations.md`，本任务仅接入其文件。
