## 完成

- 完成项目列表/看板、全部筛选与可删除 chip、排序搜索、右键菜单、键盘导航、乐观状态更新及失败回滚、近 30 天完成项目展开、封面与文件拖入。
- 完成全局单实例项目面板和共用整页详情、属性自动保存、报价/成本/利润、收退款新增编辑删除、超收确认、动态与需求、复制和软删除撤销；客户跳转与导航历史可恢复选择。
- 完成客户双栏、搜索标签排序、星标星级、联系方式和多平台账号、客户数据、项目/文件/动态、带当前客户新建项目、文件夹同步改名确认及关联项目删除提示。
- 完成共享文件区与动态时间线；文件菜单、目录分组、缩略图、子目录选择、离线/缺失告警、重新聚焦刷新和部分失败详情均接通。`FilesAddResult` 已贯通 Rust、IPC、TypeScript、Mock、hooks 和拖放反馈。
- 修复收入同期比较、今日最近 8 条单行动态及混合种子、收入图纵轴、localhost HMR；另修复面板缩放拦截 Alt 导航、删除后误刷新已删除详情、文件改名后列表封面缓存、新项目未预选当前客户等地基问题。
- 超过 100 项启用虚拟列表；360 项真实组件测试覆盖滚动和跨视口键盘焦点，3000 项组合筛选通过小于 50ms 断言。补齐完整 Mock 业务流程与失败、撤销、文件边界测试。

## 未完成 / 偏离规格

- 浏览器浅深主题、1100×700 目视检查与真实浏览器控制台验收未完成。浏览器入口返回 `The browser access host is unavailable`；Computer Use 因无法可靠识别当前浏览器 URL 被安全机制终止，随后停止界面操作。遵循 [computer-use SKILL.md](<C:/Users/Administrator/.codex/plugins/cache/openai-bundled/computer-use/26.1027.30824/skills/computer-use/SKILL.md>) 的 “If Computer Use reports that the turn ended or that the user stopped Computer Use, stop issuing app input.”。已完成真实 App 的无 console.error 集成测试、HTTP 与 HMR 验证；这些不等同于浏览器目视验收。
- 项目虚拟列表采用 DESIGN.md 的 48px 行高以容纳 40px 封面，未采用 PRODUCT.md 的 40px 紧凑行高。

## 验证

- `npm.cmd test` → 退出码 0，原始结果：

```text
 Test Files  28 passed (28)
      Tests  230 passed (230)
   Duration  56.82s (transform 627ms, setup 2.47s, collect 37.92s, tests 20.31s, environment 8.70s, prepare 1.32s)
```

- `npm.cmd run build` → 退出码 0，原始结果摘录：

```text
✓ 3242 modules transformed.
dist/assets/index-Ct1ky6Uz.js                              474.35 kB │ gzip: 145.02 kB
✓ built in 4.17s
```

- `cargo fmt --check` → `exit_code: 0`，无输出。
- `cargo clippy --all-targets -- -D warnings` → 退出码 0，原始输出：

```text
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.62s
```
- `cargo test` → 退出码 0，36 项通过；原始各组结果：

```text
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.26s
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.14s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.94s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

- `npm.cmd run dev` → `VITE v6.4.5  ready in 1249 ms`；首页、项目页、客户页、详情模块 HTTP 200，`HMR WebSocket` connected，真实 CSS 修改收到 HMR update，原样恢复文件。验证后已关闭服务，1420 无监听。
- `git diff --check` → 退出码 0；组件均不超过 300 行，未发现 TypeScript `any`。

## 给 Claude 的备注

- 报告已写入 `docs/codex-tasks/reports/2b-core-features.md`。基线仍为 `ab3980e`，未 commit/push/切分支/reset，保留任务说明原有修改。
- 无新增依赖，未修改 `docs/spec/`。按本任务授权修改两个文件添加命令的返回契约；其余后端改动仅为相关测试适配。
- Rust 验证使用 `CARGO_NET_OFFLINE=true`，没有下载依赖；开发服务检查仅访问 localhost。建议 Claude 补做上述受工具阻碍的浏览器验收。
