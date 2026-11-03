# 任务 5：设计师工作流增强（版本 2.1.0）

先读 `AGENTS.md`；规格里重点读 `docs/spec/PRODUCT.md` §7.10（新增）、§8，`docs/spec/ARCHITECTURE.md` §4.3、§4.4（新增）、§6 命令表（新增三行）。基线是 `main` 的当前 HEAD（包含 Claude 刚更新的规格和这份任务说明）。不要 commit。

## 为什么做
用户是给很多客户做设计的个人设计师，主要格式是 CDR、PSD、AI，加上图片。日常是：在微信里收资料 → 做稿 → 把成品发回微信 → 催尾款。现在这几步都要在应用、资源管理器和微信之间来回切换，而且 PSD/AI/CDR 在应用里只显示灰色类型图块，认不出是哪张稿。本任务把这条链路打通。

## 你的范围
`src-tauri/**`（不含 `updater-private.key*`、`target/`）、`src/**`、`package.json`、`package-lock.json`、`README.md`。不要动 `docs/spec/`、`.gitignore`、`scripts/`、`app/`、`我的数据/`、`release/`。

## 要做的（逐条对照 PRODUCT §7.10 和 ARCHITECTURE §4.4）

### 后端
1. **`file_thumbnail`**：按 §4.4 实现，含专用 STA 线程、5 秒超时、并发上限、`<dataDir>/thumbs` 缓存与 300MB 清理、只接受文件库内路径、启动时授权 asset 协议。Standard 和便携两种模式都用 `AppState.data_dir`。
2. **`files_copy_to_clipboard`**：写入 `CF_HDROP` 与 `Preferred DropEffect`。把构造 `DROPFILES` 缓冲区写成纯函数并做单测。
3. **`files_paste`**：读文件列表或图片，按 §4.4 规则保存；文件名生成与防重名写成纯函数并做单测；动态记录与 `files_add` 一致。
4. **封面规则**：按 §4.4 扩展 `coverPath`，补测试。
5. **依赖**：可以加 `windows` crate（只开需要的 features）、PNG 编码（`png` 或只开 png feature 的 `image`）、一个稳定哈希（如 `sha2`/`blake3`）。不要加其他依赖。在交付说明里列出新增依赖及其用途。
6. 版本升到 **2.1.0**，与任务 4 一样手工修改五处，保持格式。

### 前端
1. **缩略图**：`kind` 不是 `image` 的文件，以及超过 25MB 的图片，在图块进入视口时（IntersectionObserver）请求 `file_thumbnail(path, 256)`，有结果显示真实画面并保留扩展名徽标，没有就保持现在的淡彩类型图块。同一路径的结果要缓存，用 React Query 即可，不要重复请求。看板卡片、列表行的封面同理。
2. **大图预览**组件：按 §7.10 第 2 条实现。文件区（项目、客户）和「文件」页都接入；键盘为 Space 打开、←/→ 切换、Esc 关闭并还原焦点；非图片用 `file_thumbnail(path, 1024)`；拿不到预览时显示大号类型图块和「这个文件暂时无法预览」。注意焦点陷阱和 `aria`。
3. **多选与复制文件**：文件网格和列表支持 Ctrl/Shift 多选，出现浮动选择条（「复制 N 个文件」「取消选择」）；右键菜单加「预览」「复制文件」。项目文件区工具栏在「交付成品」有文件时显示「复制交付文件」。toast 文案见 §7.10。
4. **粘贴入库**：项目详情、客户详情在焦点不在 input/textarea/contenteditable 时监听 Ctrl+V → `files_paste`（项目使用当前「添加到」选中的子文件夹）；「添加文件」旁加「从剪贴板粘贴」。结果 toast 复用拖入的部分成功提示；剪贴板为空时提示后端返回的文案。
5. **话术变量**：
   - 写一个纯函数 `fillSnippet(body, context)` 并做单测：替换 `{客户}` `{项目}` `{报价}` `{已收}` `{待收}` `{截止日}`，金额用 `¥1,234` 格式，日期用 `11月8日`（不是今年则加年份），缺少的值保留原占位。
   - 项目详情与客户详情头部加「话术」按钮（图标 + tooltip），弹出可搜索、按分组展示的话术列表，点击后填好变量复制，并调用 `snippet_mark_used`。
   - 话术页复制时，若含未填写的变量，toast 改为「已复制（含未填写的变量）」。
   - 话术编辑弹窗加一排可点击插入的变量标签，插入到光标处。
6. **小修**：
   - 收入页指标卡下面那段灰色口径说明，改成标题旁的 ⓘ 图标，悬停或聚焦时显示。
   - 全应用不是今年的日期要带年份，例如客户详情「首次合作 1月24日」应显示为「2025年1月24日」。统一走 `lib/` 里的日期格式函数，并补测试。
   - Mock 种子：本月要有几笔真实感的收款，让「本月收入」不再只有 ¥110；最近动态里加一条粘贴入库的记录。
7. **Mock**：三个新命令都要有 Mock 实现。`file_thumbnail` 对 psd/ai 返回 `src/api/mock/assets` 里的某张图，用来演示效果，其余返回 null；剪贴板相关操作返回成功，并在 Mock 状态里记录。

### README
在功能列表补上这 5 项，写明设计文件缩略图依赖本机已安装软件提供的 Windows 缩略图（例如装了 CorelDRAW 才有 CDR 缩略图）。

## 视觉
沿用晴空风格（`docs/spec/DESIGN.md`）。预览遮罩为深色半透明背景加大圆角，选择条为白色浮动卡片配渐变主按钮，两套主题都要检查。组件 ≤ 300 行。

## 验证（结果原样写进交付说明）
- `npm.cmd test`、`npm.cmd run build`（不能有体积警告）
- `src-tauri` 下：`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`
- Windows 实机测试（`#[cfg(windows)]`）：
  - 用代码生成一张 PNG 和一张 BMP，确认 `file_thumbnail` 产出缓存 PNG、第二次命中缓存、修改文件后缓存失效；
  - 剪贴板：`files_copy_to_clipboard` 写入后，用同一模块读回 `CF_HDROP` 校验路径；写入一张位图后 `files_paste` 能存成 PNG。会覆盖本机剪贴板，测试里注明。
- 签名构建：`powershell -ExecutionPolicy Bypass -File scripts\build-tauri-signed.ps1`，写明安装包路径、大小、SHA256。
- 不要安装或卸载，不要运行 `tauri dev`，不要碰 `app/`、`我的数据/`。临时文件放 `.cache/`，结束后清理。
- 联网（如需）只走 `http://127.0.0.1:10090` 代理。

## 交付方式
对话中回复交付说明，同时写入 `docs/codex-tasks/reports/5-designer-workflow.md`。只有全部验证跑完才写这个文件。
