# 任务 0b：年轻化界面概念图交付报告

状态：四张最终概念图已完成。

## 完成

- 按任务 0b 使用内置 image_gen.imagegen；两套方向各包含今日页和项目看板。
- 仅写入 docs/spec/concepts/v2/ 与本报告；本任务未改代码、规格正文或依赖，未执行 Git 提交、推送、切分支或重置。
- 最终图片均保留工具返回的原始文件；全部画面、文字和插画来自生图或生图编辑。文件复制、元数据读取和哈希校验不改变图片。

| 方向与页面 | 最终图片 | 实际尺寸 | 格式 | 完整提示词 |
|---|---|---|---|---|
| 晴空 · 今日 | [ A-today.png ](../../spec/concepts/v2/A-today.png) | 1536×1024 | PNG | [原始提示词](../../spec/concepts/v2/prompts/A-today.txt) |
| 晴空 · 项目看板 | [ A-projects.png ](../../spec/concepts/v2/A-projects.png) | 1536×1024 | PNG | [原始提示词](../../spec/concepts/v2/prompts/A-projects.txt)；[定向修正](../../spec/concepts/v2/prompts/A-projects-correction.txt) |
| 汽水 · 今日 | [ B-today.png ](../../spec/concepts/v2/B-today.png) | 1536×1024 | PNG | [原始提示词](../../spec/concepts/v2/prompts/B-today.txt) |
| 汽水 · 项目看板 | [ B-projects.png ](../../spec/concepts/v2/B-projects.png) | 1536×1024 | PNG | [原始提示词](../../spec/concepts/v2/prompts/B-projects.txt) |

## 请求参数、执行记录与费用

- 请求尺寸：每次均在提示词中请求 1536×1024 横版；工具无独立尺寸参数。实际尺寸以表格和校验输出为准。
- 请求输出格式：PNG（提示词要求，最终按文件签名验证）。
- 数量：4 张最终交付图。实际调用共 5 次，每次 1 张：A 两张首次生成、B 两张参考编辑、A-projects 一次定向修正。未因等待时间长而重发请求。
- 透明背景参数：transparent_background=false，所有调用一致。质量档位：工具未提供独立参数或返回值，无法确认。
- 参考素材：B-today 引用 A-today；A-projects 定向修正引用 generation/A-projects-initial.png；B-projects 引用修正后的 A-projects。首次生成 A 两张未传入参考图。
- 异步支持：内置接口未暴露可选择的异步提交、服务端任务号、查询/下载入口或幂等键，支持情况无法确认；按当前任务明确授权的内置接口执行。每次调用前保存独立请求记录，返回后保存本地结果入口和原图。
- 费用及币种：工具未返回 usage、报价或账单，无法查询或计算，也无法确认实际扣款。
- 逐份请求与结果位于 [generation/](../../spec/concepts/v2/generation/)，含时间、完整提示词、参考文件、实际尺寸、源文件路径和 SHA-256。初版 A-projects 保留用于追溯，最终交付为根目录的 A-projects.png。

## 未完成 / 偏离规格

- DESIGN.md 仍规定旧「暖纸·朱印」方向并限制装饰渐变和圆角；本次按更具体的任务 0b 绘制年轻化配色、动漫横幅与大圆角。未修改 DESIGN.md 或接口契约。
- 两张今日页的「待确认」状态胶囊偏绿，应在实际实现中采用琥珀语义色。
- 今日页附加「进行中」中的「产品详情页设计」与看板的已交付状态不一致；山野咖啡动态「状态改为待确认」与当前进行中展示也有样例数据连贯性偏差。概念图不作为数据契约。
- 看板底部「咖啡店菜单设计」卡片位于可见区域边缘，未完整露出收款进度。

## 验证

任务 0b 未指定构建或测试命令；本任务不改代码，采用图片文件校验与逐图目检。

执行命令（PowerShell）：

```powershell
Add-Type -AssemblyName System.Drawing; $conceptFiles = @(Get-ChildItem -LiteralPath 'docs/spec/concepts/v2' -Filter '*.png' -File | Sort-Object Name); if ($conceptFiles.Count -ne 4) { throw 'Expected 4 final PNGs' }; foreach ($conceptFile in $conceptFiles) { $conceptImage = [System.Drawing.Image]::FromFile($conceptFile.FullName); try { if ($conceptImage.Width -ne 1536 -or $conceptImage.Height -ne 1024 -or $conceptImage.RawFormat.Guid -ne [System.Drawing.Imaging.ImageFormat]::Png.Guid) { throw ('Invalid image: ' + $conceptFile.Name) }; Write-Output ('{0}: {1}x{2} PNG' -f $conceptFile.Name,$conceptImage.Width,$conceptImage.Height) } finally { $conceptImage.Dispose() } }; Write-Output 'PASS: 4/4 final PNGs, 1536x1024'
```

原始输出（退出码 0）：

```text
A-projects.png: 1536x1024 PNG
A-today.png: 1536x1024 PNG
B-projects.png: 1536x1024 PNG
B-today.png: 1536x1024 PNG
PASS: 4/4 final PNGs, 1536x1024
```

Node.js（node_repl）读取每张 final/source 文件并比较 SHA-256，原始输出：

```text
A-today.png: SHA-256 matches original
A-projects.png: SHA-256 matches original
B-today.png: SHA-256 matches original
B-projects.png: SHA-256 matches original
PASS: 4/4 files identical to generated originals
```

原图一致性校验不修改任何图像字节。

目检内容：四项指标 3 / 2 / ¥1,280 / ¥8,640 和 +12%；侧栏六导航、视图 3/5、四标签、文件库状态；A 工作室与 B 咖啡馆插画；六个月柱状图；看板五列、24 项计数、金额合计、海报预览和拖动效果。已发现的细微偏差列于上文。

## 给 Claude 的备注

- 本次只提交视觉概念，不改变业务接口；最终 UI 仍须使用 PRODUCT.md / ARCHITECTURE.md 的真实派生数据与状态语义。
- A-projects 初版误生成云端同步说明及进行中列额外项目计数，已通过生图工具作定向修正；原图、修正提示词和独立请求均保留。
- 无新增依赖。

## 完整提示词

以下为实际调用提交的完整提示词；独立 TXT 与 request.json 同时保留。

### A-today

```text
Use case: ui-mockup
Create ONE exceptional high-fidelity Windows desktop productivity app screenshot, landscape 1536x1024 pixels, PNG. Render the entire image, including all text, icons, chart and illustration. This is the actual app content filling the canvas, orthographic front view, no desktop wallpaper, browser chrome, device casing, hands outside the illustration, perspective, presentation frame, watermarks or design annotations. It should look like a beautifully shipped premium Chinese app, youthful, sophisticated, airy, useful every day, not a landing page. App name is 客户工作台, for a solo designer managing clients, projects, files and payments.

Direction A 晴空. Background #F6F7FB with barely visible periwinkle and sky-blue ambient glow. White floating sidebar and white cards, very soft realistic layered shadows, fine pale edges, 16–20px corner radii, precise alignment and generous whitespace. Rich dark indigo text #1E1B4B. Primary accent is a gentle #6366F1 to #38BDF8 gradient, used on primary buttons and active emphasis. Cohesive pastel icon tiles #EEF0FF, #E6F6FE, #E7F8F1, #FFF1EA. Fine consistent line icons, not emoji. Modern crisp Chinese sans-serif typography resembling Microsoft YaHei UI, polished tabular digits. Main headings and numbers are big; secondary labels are still readable. Avoid heavy blur, low contrast, excessive decoration or childish toy styling.

Layout: ~232px wide floating white sidebar inset 16px from canvas edges, full height; main area from x=276 to1512, 24px gutters. A discreet top bar includes 今日 and date 周一，11月2日 and small native window controls at top right. Top illustrated hero approximately y=72 to332, full main width with 20px rounded corners. Under hero a single row of exactly FOUR equal metric cards, then a lower two-column workspace: a wider left attention list, right income chart above activity timeline. All panels fit the canvas cleanly.

Sidebar: rounded square periwinkle-blue gradient logo containing a white folder and check mark; to its right 客户工作台, small subtitle 每一单，都被好好照顾. Search field 快速搜索 with keyboard badge Ctrl K. Six navigation rows with thin line icons: 今日 (active white pill with indigo left indicator and soft indigo backing), 项目, 客户, 收入, 文件, 话术. Then section 视图: 星标, 逾期 with count 3, 待收款 with count 5. Then section 标签 with colored dots and labels 老客户, 餐饮, 加急, 品牌. Bottom a pale green status card 文件库已连接, then 设置 and sun/moon light-dark toggle icons. Clean vertical rhythm, all text legible.

Hero: premium detailed Japanese anime editorial illustration on RIGHT half, seamlessly fading into a pale airy gradient on LEFT half for perfectly readable text. A young adult female designer with headphones working beside a sunlit studio window on a pen tablet. On desk: spread poster design drafts, color swatches, mug; orange cat resting at desk corner. Through window: beautiful blue sky, white clouds and city skyline. Fine clean anime linework, luminous afternoon sunlight, delicately painted details, warm human atmosphere, gorgeous composition, no overlaid text over her face. Left text must read EXACTLY 下午好，今天也闪闪发光, with a tasteful line break after comma, large ~38px bold dark indigo. Below: 3 个项目进行中，2 个本周到期，还有 ¥1,280 待收. Beneath are a gradient primary button + 新建项目 and a light secondary action 查看全部项目 →. Balance the UI and illustration; the illustration is inside the hero only.

Four metric cards left to right, each with one pastel colored rounded line-icon tile, clear label and large numeric value: 进行中 / 3; 本周到期 / 2; 待收款 / ¥1,280; 本月收入 / ¥8,640 with small green 较上月 +12%. Do not add a fifth metric or change values.

Lower left white panel: heading 需要关注 and small count 3, right 查看全部 →. Three spacious rows, each has circular Chinese initial avatar, title, client, a text status pill, due chip and right-aligned quote amount:
林 / 夏季新品海报设计 / 林女士 / 进行中 / red 逾期 2 天 / ¥1,280
陈 / 品牌包装修改 / 陈先生 / 待确认 / red 逾期 1 天 / ¥860
山 / 咖啡店菜单设计 / 山野咖啡 / 进行中 / orange 明天 / ¥960
Below the attention rows, a small secondary 进行中 section can show 双十一活动主图 · 小鹿花店 and 产品详情页设计 · 森临家居, retaining whitespace and hierarchy.

Lower right: white 本月收入 panel, bold ¥8,640, green 较上月 +12%, elegant six-bar chart labeled 6月 7月 8月 9月 10月 11月. Earlier bars pale periwinkle, current 11月 bar indigo-to-sky gradient. Under it, white 最近动态 panel with a fine vertical timeline, small coherent pastel icons, three readable entries: 林女士 · 收到微信付款 ¥500 / 10分钟前; 小鹿花店 · 添加了 3 个文件 / 35分钟前; 山野咖啡 · 状态改为待确认 / 1小时前.

Render ALL Simplified Chinese faithfully and sharply with correct character shapes, including 洽/款/期 if present; no gibberish, no faux text. All monetary values use ¥ and thousands separators. No English headings other than Ctrl K. The output must be a single complete app screen, not a collage, not source code, not a wireframe.
```

### A-projects

```text
Use case: ui-mockup
Create ONE exceptional high-fidelity Windows desktop productivity app screenshot, landscape 1536x1024 pixels, PNG. Generate every pixel including Chinese UI text, icons, charts and miniature poster previews. Actual app content fills the whole canvas, straight-on orthographic view. No desktop wallpaper, browser chrome, device casing, external hands, perspective, presentation frame, watermarks or annotations. App name 客户工作台, a premium daily tool for a solo designer managing clients, projects, files and payments. This image is the PROJECT KANBAN screen, not a dashboard and not a project detail panel.

Direction A 晴空: #F6F7FB app background with extremely subtle blue/periwinkle ambient glows. White floating sidebar and white 16–20px rounded cards, exquisite soft shadows, fine edges and generous breathable spacing. Deep indigo text #1E1B4B. Primary gradient #6366F1 to #38BDF8; coherent pale icon tiles #EEF0FF / #E6F6FE / #E7F8F1 / #FFF1EA. Elegant precise Chinese sans-serif, large title, sharp readable tabular amounts, thin consistent line icons, no emoji. Sophisticated youthful aesthetic, not childish, not cluttered.

Composition: floating white ~232px sidebar at x16 y16 to bottom. Main area x276 to1512. A large page title 项目 followed by count badge 24 at upper left. Header right: segmented 列表 | 看板 (看板 active), search field 搜索项目…, blue-purple gradient + 新建项目. Small unobtrusive Windows window controls at very top right. Second row of rounded filter pills 全部状态, 标签, 客户, 收款状态, 截止日, 来源平台; far right 按截止日排序. Comfortable top spacing, board begins around y190 and extends downward. Show FIVE FULLY VISIBLE columns side by side, evenly spaced, ~230px wide. Do not crop the final column. No right-side details drawer.

Sidebar: rounded square gradient logo with white folder and check; 客户工作台 and subtitle 每一单，都被好好照顾. Search 快速搜索 with Ctrl K. Navigation 今日, 项目 (selected white pill, indigo left bar and pale backing), 客户, 收入, 文件, 话术 with fine line icons. Section 视图: 星标, 逾期 3, 待收款 5. Section 标签: colored dots 老客户, 餐饮, 加急, 品牌. Bottom pale green 文件库已连接 status card, 设置 and sun/moon theme icons. Consistent typography and precise margins.

Kanban columns ordered LEFT TO RIGHT exactly 洽谈中, 进行中, 待确认, 已交付, 已完成. Each column header has colored status dot, title, count badge, plus action, then a smaller amount total. Counts total 24: 洽谈中 4 合计 ¥6,200; 进行中 3 合计 ¥3,120; 待确认 5 合计 ¥4,760; 已交付 4 合计 ¥4,200; 已完成 8 合计 ¥8,640. Status dot semantics: purple-gray, blue, amber, teal, green respectively. Column backgrounds can be extremely pale tinted neutral, not saturated slabs.

Cards: beautiful white 16px round cards with ~16px inner padding; crisp Chinese title, small circular Chinese initial avatar and client name, one or two pastel colored tag pills, date chip, bold quote amount, thin payment progress line and readable 已收 amount / quote, tiny attachment icon and file count. Some cards contain attractive wide miniature poster thumbnail images with a few sharp Chinese words. Allow differing card heights and abundant open column space. Only show the first 2–3 cards per column, with a subtle 查看更多 hint for remaining projects, so the full totals remain sensible.

Concrete cards:
Column 洽谈中: 品牌标志升级, 陈先生 with 陈 avatar, 品牌 tag, 11月6日, ¥2,400, 已收 ¥0 / ¥2,400 and empty progress; 会员卡设计, 拾光书店 with 拾 avatar, 老客户 tag, 无截止日, ¥360, 已收 ¥0 / ¥360.
Column 进行中: 夏季新品海报设计, 林女士 with 林 avatar, 老客户 + 加急 tags, RED 逾期 2 天 chip, ¥1,280, 已收 ¥800 / ¥1,280, progress about63%, thumbnail of a fresh lemon drink poster with text 夏季新品. Second 双十一活动主图, 小鹿花店 with 鹿 avatar, 加急 tag, 11月8日, ¥880, 已收 ¥440 / ¥880, progress50%, small pink floral campaign thumbnail. Third 咖啡店菜单设计, 山野咖啡, 餐饮 tag, 明天, ¥960.
Column 待确认: 品牌包装修改, 陈先生, 品牌 tag, RED 逾期 1 天, ¥860, 已收 ¥620 / ¥860. Second 节日宣传单, 王先生 with 王 avatar, 加急 tag, 11月16日, ¥480, 已收 ¥380 / ¥480. ONE card in this column is actively being dragged: very slight ~2° rotation, a little raised with deeper soft shadow, subtle placeholder behind it, and a small arrow pointer close to it. Preserve the readability of the title. No human hand.
Column 已交付: 包装礼盒设计, 青禾茶铺 with 青 avatar, 老客户 tag, 11月10日, ¥1,600, 已收 ¥1,600 / ¥1,600, full teal progress, 已收清 and subtle 可以标记完成. Include refined mint tea-package thumbnail. Second 产品详情页设计, 森临家居, 品牌 tag, 11月14日, ¥1,200, full progress.
Column 已完成: 门店开业海报, 赵女士 with 赵 avatar, 餐饮 tag, 11月2日, ¥680, full green progress, 已收清, attractive editorial coffee poster thumbnail. Second 会员卡改版, 拾光书店, 老客户 tag, ¥360, full green progress, 已收清. Small footer 近 30 天完成 · 查看全部.

Keep exactly five columns, with readable spacing and all required metadata. Young, airy, beautifully composed yet useful. All visible UI text must be Simplified Chinese with accurate glyphs, never gibberish. All money uses ¥ with thousands separators. Do not add English design labels, a hero illustration, a sixth cancelled column, or a project detail panel.
```

### A-projects-correction

```text
Use case: ui-mockup / precise-object-edit / text-localization
Edit the supplied A-projects-initial.png into ONE final 1536x1024 PNG. This is the same premium Chinese local Windows app 客户工作台. Preserve the entire image exactly as much as possible: all five kanban columns, palette, typography, positions, titles, amounts, counts, illustrations, filters, project selection, the slightly rotated dragged card and its shadow.

Make ONLY these small corrections:
1. In the bottom-left green sidebar status card retain the heading 文件库已连接. Replace the small incorrect cloud-sync description with two clear Simplified Chinese lines: 本地文件库可用 and 打开文件库. Replace the cloud-outline icon in this same status card with a simple folder outline icon. This product stores files locally and offers no cloud sync, so there must be no 云端 or 同步 wording anywhere. Keep the green status check, pale green card, its size and placement.
2. At the very bottom of the 进行中 column, replace the inaccurate footer 查看更多 1 个项目 with 共 3 个项目. There are already three project cards in this column and its header correctly says 3. Keep every other column's existing footer unchanged.

Do not redesign, restyle or reflow anything. Do not change the four sidebar tag names, five column headings, quote values or payment progress. Do not introduce a new header, banner or panel. All text stays sharp and accurate Simplified Chinese. No external frame, watermark or added annotations. Produce the full final app screenshot through image editing, not a separate text patch.
```

### B-today

```text
Use case: ui-mockup / style-transfer
Create ONE final landscape 1536x1024 PNG app screenshot using the supplied A-today screenshot as the edit target and structural reference. Transform this exact screen to direction B 汽水. Preserve the same layout, sidebar proportions, card placement, FOUR statistics, attention rows, chart, timeline, all Chinese words and all numerical values. Generate the full final image with the image model; do not leave a blank compositing area. Render crisp high-fidelity Chinese UI, like a released premium Windows desktop app. No desktop wallpaper, device, browser frame, perspective, external hands, watermarks or annotations.

Change only the visual direction and hero illustration as follows. Primary accent becomes gentle peach-coral #FF7A59 to berry-pink #FF5C8A gradient on the main button, selected navigation indication and current chart bar. App background becomes warm #FFF8F5 with barely visible peach and mint ambient glow. Main text is rich deep brown #2A1E1B. White floating panels and 16–20px corners retain refined soft shadows and whitespace. Coordinated pastel icon tiles and small accents use mint #2DD4BF, pale purple #A78BFA, lemon #FACC15. Cheerful summer soda freshness, polished and spacious, suitable for daily professional work. Status chips retain blue for active, amber for review, red for overdue, green for paid; do not make every indicator pink.

Replace ONLY the hero illustration with an equally detailed Japanese anime editorial illustration: a young adult female designer working on a laptop in a bright street-corner cafe by a large window. On table: a clear bottle or glass of sparkling soda, color swatches and printed posters. Outside are sunny summer streets and lush green trees. Fine clean anime linework, beautiful warm summer light, gentle colors. Illustration stays on the RIGHT, seamless warm pale gradient negative space on the LEFT; same scale and high quality as A. Preserve the headline EXACTLY 下午好，今天也闪闪发光 and subtitle 3 个项目进行中，2 个本周到期，还有 ¥1,280 待收, with both buttons 新建项目 and 查看全部项目 →.

Mandatory invariants: sidebar 客户工作台, 每一单，都被好好照顾, 快速搜索 / Ctrl K; 今日 selected; navigation 项目 客户 收入 文件 话术; 视图 entries 星标 / 逾期 3 / 待收款 5; 标签 entries 老客户 餐饮 加急 品牌; bottom 文件库已连接, 设置, sun/moon icons. All four statistics remain 进行中 3 / 本周到期 2 / 待收款 ¥1,280 / 本月收入 ¥8,640 and 较上月 +12%. Need-attention rows preserve 夏季新品海报设计 · 林女士 · 进行中 · 逾期 2 天 · ¥1,280; 品牌包装修改 · 陈先生 · 待确认 · 逾期 1 天 · ¥860; 咖啡店菜单设计 · 山野咖啡 · 进行中 · 明天 · ¥960. Right 本月收入 chart has exactly six months 6月 to11月, current bar coral-pink gradient. 最近动态 timeline remains visible with 林女士 · 收到微信付款 ¥500, 小鹿花店 · 添加了 3 个文件, 山野咖啡 · 状态改为待确认.

Preserve precise Simplified Chinese, sharp typography and correct money values; repair any obvious accidental malformed glyph from reference while retaining its intended text. No layout redesign, no extra stats, no disappearance of required sections. This is one complete screenshot, not a comparison or collage.
```

### B-projects

```text
Use case: ui-mockup / style-transfer
Create ONE final landscape 1536x1024 PNG screenshot using the supplied A-projects screenshot as the edit target and structural reference. Transform this exact project kanban screen to direction B 汽水. Preserve sidebar, header, controls, all FIVE fully visible columns, card locations, miniature poster previews, the gently rotated actively dragged card, all Chinese words and all values. Produce every final pixel with the image model. Screenshot of actual premium Windows desktop app content filling the canvas, front-on orthographic, no external device, desktop, browser chrome, hands, perspective, watermarks, annotations or comparison panel.

Change visual direction only. Warm app background #FFF8F5 with extremely subtle peach/mint ambient light. Deep brown #2A1E1B text, bright white rounded floating sidebar and card surfaces, airy generous whitespace, 16–20px corners and refined soft shadows. Replace primary periwinkle-blue gradient with peach-coral #FF7A59 to berry-pink #FF5C8A gradient on + 新建项目, selected navigation indication and active view accent. Coordinated pastel accent tiles use mint #2DD4BF, pale purple #A78BFA and lemon #FACC15. Overall fresh like summer soda, youthful and beautifully polished but still professional. Keep semantic status dots purple-gray/blue/amber/teal/green, red overdue chips and green paid labels, rather than coloring every status coral. Keep miniature poster design previews as content, not broad decorative hero art.

Exact content invariants: app 客户工作台 with subtitle 每一单，都被好好照顾; 快速搜索 with Ctrl K; sidebar 今日 / 项目(selected) / 客户 / 收入 / 文件 / 话术; 视图 with 星标 / 逾期 3 / 待收款 5; 标签 with colored dots 老客户 / 餐饮 / 加急 / 品牌; bottom 文件库已连接 / 设置 and light-dark switch icons. Header 项目 24, segmented 列表 | 看板 with 看板 active, search 搜索项目…, + 新建项目. Filter pills 全部状态 / 标签 / 客户 / 收款状态 / 截止日 / 来源平台 and 按截止日排序.

Exactly FIVE columns left to right: 洽谈中 4 合计 ¥6,200; 进行中 3 合计 ¥3,120; 待确认 5 合计 ¥4,760; 已交付 4 合计 ¥4,200; 已完成 8 合计 ¥8,640. Counts total24; partial visible cards have 查看更多 hint. Every column retains status dot, count and amount sum.

Preserve card title, client initial avatar and name, colored tag pills, due-date chip (red overdue), bold quoted amount, thin payment progress and collected/quoted amount, file count; some cards retain attractive wide miniature Chinese posters. Key cards: 品牌标志升级 / 陈先生 / ¥2,400; 会员卡设计 / 拾光书店 / ¥360; 夏季新品海报设计 / 林女士 / 老客户 加急 / 逾期 2 天 / ¥1,280 / 已收 ¥800 / ¥1,280; 双十一活动主图 / 小鹿花店 / ¥880 / 已收 ¥440 / ¥880; 咖啡店菜单设计 / 山野咖啡 / 明天 / ¥960; 品牌包装修改 / 陈先生 / 待确认 / 逾期 1 天 / ¥860 / 已收 ¥620 / ¥860; 节日宣传单 / 王先生 / ¥480; 包装礼盒设计 / 青禾茶铺 / ¥1,600 / 已收清 / 可以标记完成; 产品详情页设计 / 森临家居 / ¥1,200; 门店开业海报 / 赵女士 / ¥680 / 已收清; 会员卡改版 / 拾光书店 / ¥360 / 已收清. Final column footer 近 30 天完成 · 查看全部. One card stays raised, ~2° rotated, with deeper shadow and subtle placeholder to show drag operation, without human hands.

Additional strict invariants from the corrected reference: the bottom-left status card says 文件库已连接 / 本地文件库可用 / 打开文件库 and uses a folder-outline icon. This is a local app with no cloud sync: do not add 云端 or 同步 wording. The active 进行中 column footer says 共 3 个项目, because its three cards are already visible; keep that exact footer and count.

Preserve clear accurate Simplified Chinese with correct glyphs, all monetary values use ¥ and thousands separators. Repair obvious malformed reference glyphs without changing intended content. No layout redesign, no sixth column, no detail drawer, no dashboard hero, no gibberish. Single complete app screenshot.
```
