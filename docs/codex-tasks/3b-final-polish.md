# 任务 3b：最终收尾（Claude 终验发现的问题 + 验收清单 + 重打安装包）

先读 `AGENTS.md`、`docs/spec/` 三份规格、`docs/codex-tasks/reports/3-rest-and-ship.md`。基线为 git 提交 `520eccd`，不要 commit。

## 你的范围
`src/**`、根目录前端配置、`src-tauri/**`（除 `updater-private.key*`、`target/` 内手工改动）、`README.md`。不要改 `docs/spec/`。

## 必须修
1. **收入页「待收」口径错误**：现在「待收」指标和「待收款项目」表只统计「本期创建的项目」，导致「本月」显示 ¥0 和「这一期的款项都收齐了」，而今日页显示还有 ¥4,670 待收、侧栏「待收款 7」——用户会以为数据错了。改为：
   - 「待收」指标 = **当前**所有未取消项目的待收合计（不随时间范围变化），标题改为「当前待收」，不显示环比，副文案「共 N 个项目未收齐」；
   - 「待收款项目」表 = 当前所有待收 > 0 的未取消项目，按待收金额降序，与今日页、侧栏「待收款」计数口径完全一致；
   - 其余指标（实收、成本、利润、成交数、客单价）保持按时间范围统计；页面上的口径说明文字同步更新。
   - `lib/stats.ts` 补单测：今日页、侧栏、收入页三处待收合计一致。
2. **利润折线过冲**：收入趋势图的利润线用了会过冲的平滑曲线，在 0 以下和柱顶以上出现不存在的数值。改为 `type="monotone"`（或折线），并确认 y 轴下限在有负利润时才低于 0。
3. **主 chunk 超过 500KB**（531.78 kB）：各业务页面与重型组件（收入图、看板/dnd、命令面板等）按路由 `React.lazy` 拆分，配合骨架屏作为 Suspense fallback；Mock 仍为独立懒加载 chunk。构建不再出现 chunk 体积警告。

## 验收清单（逐条给出证据）
对照 `docs/spec/PRODUCT.md` §10 的 10 条验收标准，逐条在交付说明中写：✅/⚠️、对应的自动化测试名称（文件 + 用例名）或手工验证方式。缺少自动化覆盖的条目（例如删除撤销、回收站恢复、标签合并、命令面板搜到话术等），补写基于 Mock 的组件/集成测试。

## 最后
- `npm.cmd test`、`npm.cmd run build`（无体积警告）
- `src-tauri` 下 `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`
- 重新打安装包：`npm.cmd run tauri build`；若因缺少签名私钥失败，用临时配置关闭 `createUpdaterArtifacts` 再打（与任务 3 相同做法），写明安装包路径、大小、SHA256。正式配置保持 `createUpdaterArtifacts: true`。
- 不要运行 `tauri dev` 留下新的应用数据；若运行了，结束后说明。

## 交付方式
对话回复交付说明，同时写入 `docs/codex-tasks/reports/3b-final-polish.md`。
