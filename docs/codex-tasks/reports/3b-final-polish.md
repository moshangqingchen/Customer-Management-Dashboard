## 完成

- 基于 `520eccdd24da1d532853e8ebc0bb4fe7a8a99de9` 完成 3b，未 commit、push、切分支或 reset。
- 收入页改为「当前待收」：统计所有未取消项目的当前待收，不随周期变化，不显示环比，显示「共 N 个项目未收齐」。待收表按金额降序，跨期项目保留，说明与空态同步更新；实收、成本、利润、成交数、客单价保持原周期统计。
- 今日页、侧栏、收入页共用 `outstandingProjects`，新增跨期、退款、取消、超收和三处口径一致性测试。
- 基线的利润线已经是 `type="monotone"`，本次保留，并显式设置 y 轴下限：无负利润从 0 开始，有真实负利润才低于 0。新增真实 SVG 曲线控制点和轴刻度测试，验证没有过冲。
- 今日、项目、客户、收入、文件、话术、设置、欢迎页按路由懒加载；看板/dnd、项目详情、命令面板和新建弹窗按需加载，配骨架屏。Mock 仍为独立懒加载 chunk。最终入口 JS 为 300.65 kB，最大图表 chunk 为 366.68 kB，无 chunk 体积警告。
- 弹窗首次加载采用可取消、可 Esc 关闭的骨架；去掉与 Dialog 焦点管理冲突的输入框 `autoFocus`，由 Dialog 统一聚焦。新增冷、热两次命令面板打开及关闭焦点恢复测试。
- 重新产出 [NSIS 安装包](<D:/project development/创业客户管理工作台/src-tauri/target/release/bundle/nsis/客户工作台_2.0.0_x64-setup.exe>)，6,093,904 字节（5.8116 MiB）。使用任务允许的临时无更新签名配置，正式配置保持 `createUpdaterArtifacts: true`。

PRODUCT §10 逐条证据（以下均为已通过的自动化测试；第 9 条保留人工验收限制）：

| 条目 | 结论 | 文件 + 用例名称 / 验证方式 |
|---|---|---|
| 1. 首次选库、进入今日、重启持久化 | ✅ | `src/App.integration.test.tsx` → `首次选择文件库后进入工作台，页面快捷键和导航历史互通且无渲染错误`；`src/api/mock/mock.test.ts` → `重新加载Mock模块后从localStorage恢复文件库、客户、项目与收款`。后者清除模块缓存后重新导入并读取持久化数据。真实 SQLite 补充证据：`src-tauri/tests/repository.rs` → `reopen_preserves_schema_data_and_settings`。 |
| 2. 客户→项目→3 文件→2 收款→完成、动态完整 | ✅ | `src/CoreFeatures.integration.test.tsx` → `新建客户 → 为其新建项目 → 拖入3个文件 → 记2笔收款 → 完成，全程在项目面板且动态完整保留`。通过 UI 创建，拖入 PNG/PSD/PDF，检查图片缩略图，记录 ¥500 与 ¥780，交付并完成，检查创建、文件、两笔款与两次状态动态。 |
| 3. 看板换列、刷新保持 | ✅ | `src/pages/ProjectsPage.test.tsx` → `键盘拖动到空看板列会持久化状态，Escape取消拖动，重新挂载仍位于目标列`。使用真实 dnd 键盘传感器，销毁视图及 QueryClient 后重新挂载。 |
| 4. 标签全流程 | ✅ | `src/AcceptanceInteractions.integration.test.tsx` → `标签可创建改色、关联客户项目、从侧栏筛选，合并后两种关联均保留且去重`。使用真实 Mock、完整 App、React Query 交互并验证持久化关系。 |
| 5. 逾期关注区和侧栏计数 | ✅ | `src/AcceptanceCore.integration.test.tsx` → `逾期项目出现在今日需要关注和侧栏计数中，已完成与已取消不计入`。核对种子 3 项加新增 1 项的「逾期 4」。 |
| 6. 收入手算、退款和取消排除 | ✅ | `src/lib/core.test.ts` → `按付款日期汇总含退款，成本按创建周期，排除取消`；`src/lib/stats.test.ts` → `今日页、侧栏与收入页的当前待收合计和项目口径一致，切换周期不变`；`src/pages/IncomeFilesPage.test.tsx` → `跨期欠款始终显示当前待收、项目数和金额降序，其他指标随周期改变`。 |
| 7. 话术复制、命令面板搜客户/项目/话术 | ✅ | `src/pages/SettingsSnippets.test.tsx` → `话术保留换行复制并记录使用次数，搜索会跨越当前分组`；`src/App.integration.test.tsx` → `命令面板回车复制话术并保留换行，选择收款项目时表单随项目重置`；`src/AcceptanceInteractions.integration.test.tsx` → `命令面板能搜到客户与项目，回车打开相应详情`。 |
| 8. 删除撤销、回收站恢复 | ✅ | `src/AcceptanceInteractions.integration.test.tsx` → `项目删除后点击通知撤销可找回，再次删除可从设置回收站恢复`。实际点击通知「撤销」和设置回收站「恢复」，验证项目重新出现。 |
| 9. 浅深主题文字清晰 | ⚠️ | `src/AcceptanceCore.integration.test.tsx` → `浅深主题按钮更新文档主题、选择状态及持久化设置`、`light主题正文与次要文字在主要表面上达到4.5:1对比度`、`dark主题正文与次要文字在主要表面上达到4.5:1对比度` 均通过。覆盖实际 token 中正文/次要文字与六种主表面的对比度；全部页面、语义 pill、插画叠字等人工视觉验收未完成，原因见下。 |
| 10. 构建、测试、安装包 | ✅ | 本次最终 `npm.cmd test`、`npm.cmd run build`、Rust 三项检查通过；签名私钥缺失后按任务授权的临时配置成功打包。原始结果见「验证」。 |

## 未完成 / 偏离规格

- 第 9 条完整人工视觉验收未完成。Computer Use 返回 `The browser access host is unavailable`；选择现有 Edge 空白窗口后又返回 `Computer Use has been stopped for this turn because it could not determine the current browser URL on Windows with enough confidence to enforce policy.`，因此未继续界面输入。已遵循 [computer-use 技能](<C:/Users/Administrator/.codex/plugins/cache/openai-bundled/computer-use/26.1027.30824/skills/computer-use/SKILL.md>) 及工具停止指令；自动化主题证据不能代替全页实机观察。
- PRODUCT §7.5「每个带与上一周期对比」与本次任务「当前待收不显示环比」冲突，按本次任务执行。未改动 ARCHITECTURE §3–§6 接口契约或规格文件。
- 缺少更新签名私钥，正式打包命令在生成安装器后退出 1；已使用任务允许的临时配置成功重打。本包未附更新签名产物，正式 `createUpdaterArtifacts` 保持为 `true`。

## 验证

- `npm.cmd test` → 退出码 0，最终原始摘要：

```text
 Test Files  39 passed (39)
      Tests  286 passed (286)
```

- `npm.cmd run build` → 退出码 0，无 chunk 体积警告，最终独立构建原始摘要：

```text
dist/assets/mock-NFUwWc7g.js                                32.24 kB │ gzip:  12.58 kB
dist/assets/react-vendor-WziCHOQZ.js                       223.01 kB │ gzip:  69.35 kB
dist/assets/index-DdLq919Q.js                              300.65 kB │ gzip:  95.44 kB
dist/assets/CartesianChart-CUT2belx.js                     366.68 kB │ gzip: 107.66 kB
✓ built in 3.85s
```

- `cargo fmt --check`（`src-tauri`）→ 无输出，退出码 0。
- `cargo clippy --all-targets -- -D warnings`（`src-tauri`）→ 退出码 0，原始摘要：

```text
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.44s
```

- `cargo test`（`src-tauri`）→ 退出码 0，36 项通过；各目标原始摘要：

```text
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.04s
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.27s
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.11s
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.15s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.75s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

- `npm.cmd run tauri build` → 安装器生成后退出码 1，原始错误：

```text
A public key has been found, but no private key. Make sure to set `TAURI_SIGNING_PRIVATE_KEY` environment variable.
```

- `npm.cmd run tauri build -- --config '.cache/task3.unsigned-build.json'` → 退出码 0；沿用任务 3 的临时配置，仅覆盖 `bundle.createUpdaterArtifacts=false`，未修改正式配置。最终原始摘要：

```text
    Finished `release` profile [optimized] target(s) in 29.21s
    Finished 1 bundle at:
        D:\project development\创业客户管理工作台\src-tauri\target\release\bundle\nsis\客户工作台_2.0.0_x64-setup.exe (5.81 MiB)
```

- `Get-Item`、`Get-FileHash -Algorithm SHA256` → 最终安装包 6,093,904 字节，SHA256：`369D183BDA8E3C0A6D4086ACB0C8F5C934890584745FEEFD0994C8E730CE60A9`。
- `git -c core.safecrlf=false diff --check` → 无输出，退出码 0。生产组件均 ≤ 300 行，未引入 TypeScript `any`（现有测试中的 `expect.any` 为断言 API）。
- 本次未运行 `tauri dev`，未启动桌面应用或测试安装器。仅为尝试界面验收启动过 `npm.cmd run dev`，已停止，1420 端口已无监听。

## 给 Claude 的备注

- HEAD 保持 `520eccdd24da1d532853e8ebc0bb4fe7a8a99de9`；保留原有未跟踪的 `docs/codex-tasks/3b-final-polish.md`。无新增依赖，未更改私钥、公钥、更新 endpoint、正式打包配置或任何规格文件。
- 安装包路径：`src-tauri/target/release/bundle/nsis/客户工作台_2.0.0_x64-setup.exe`；SHA256 为 `369D183BDA8E3C0A6D4086ACB0C8F5C934890584745FEEFD0994C8E730CE60A9`。
- 第 1–8、10 条已有自动化 / 构建证据，第 9 条请在可用的浏览器或桌面环境中补完人工视觉验收。任务 3 遗留的真实更新下载安装、任务栏图标等实机项目未被本报告冒充已验证。
