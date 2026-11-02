## 完成

- 已完成任务 0 的全部 6 张目标图片。接续时保留已有 3 张图标，补齐 3 张界面概念图。
- 均使用内置 `image_gen.imagegen`。图中文字、版面、海报缩略图及最终画面均由生图工具生成；本地只复制原始文件、读取元数据及校验哈希。
- 项目深色图以项目浅色原图为编辑参考，保持同一布局。今日页经过一次局部编辑，已把侧栏计数“3”从“星标”移到“逾期”；初版保留在 [today-light-v1.png](../../spec/concepts/generation/today-light-v1.png)。
- 每份请求的完整提示词及参数保存于 `docs/spec/concepts/generation/*.request.json`，结果路径与校验信息保存于对应 `*.result.json`。本报告下方也逐字收录全部提示词。

### 文件与参数

尺寸只在提示词中请求；内置工具没有可单独设置的 size、quality、model、数量或格式参数。各次请求均要求单张 PNG，并各返回 1 张。透明背景通过工具参数明确设置。

| 图片 | 最终文件（均在 docs/spec/concepts/） | 请求尺寸 | 原图实际尺寸 | 数量／格式 | 背景参数及实测 |
|---|---|---|---|---|---|
| 朱印 | [icons/icon-1.png](../../spec/concepts/icons/icon-1.png) | 1024×1024 | 1254×1254 | 1／PNG | transparent_background=true；透明（RGBA） |
| 文件夹＋勾 | [icons/icon-2.png](../../spec/concepts/icons/icon-2.png) | 1024×1024 | 1254×1254 | 1／PNG | transparent_background=true；透明（RGBA） |
| 叠放卡片 | [icons/icon-3.png](../../spec/concepts/icons/icon-3.png) | 1024×1024 | 1254×1254 | 1／PNG | transparent_background=true；透明（RGBA） |
| 项目浅色 | [projects-light.png](../../spec/concepts/projects-light.png) | 1536×1024 | 1536×1024 | 1／PNG | transparent_background=false；不透明（RGB） |
| 项目深色 | [projects-dark.png](../../spec/concepts/projects-dark.png) | 1536×1024 | 1536×1024 | 1／PNG | transparent_background=false；不透明（RGB） |
| 今日浅色 | [today-light.png](../../spec/concepts/today-light.png) | 1536×1024 | 1536×1024 | 1／PNG | transparent_background=false；不透明（RGB） |

- 实际模型：全部无法确认，内置工具未返回；按用户最新授权未指定模型。
- 质量档位：全部无法确认，工具未提供 quality 参数或返回值。“高保真”仅为提示词里的视觉要求，不代表可核实的质量档位。
- 费用和币种：每张均无法查询，合计同样无法确认。工具未返回 usage、单价或账单，因此不能按已知依据估算，也不声称免费或实际扣款。今日页还包括一次局部编辑请求，其费用和币种同样未知。
- 其他已设置参数：图标 `transparent_background=true`；界面图及今日页修正 `false`。项目深色图设置 `referenced_image_paths` 指向项目浅色原图；今日修正设置该参数指向修正前今日原图。其余新图未设置引用图参数。
- 异步：工具未暴露异步提交、任务号、状态查询、下载入口或幂等键接口，供应商级异步支持无法核实；使用当前内置工具调用并等待返回，没有切换供应商或 CLI。输出的原始本地路径均已记录。请求文件中的 `prepared` 表示提交前快照，最终状态以 result 文件为准。

## 未完成 / 偏离规格

- 目标文件缺失：无。
- 3 张既有图标的实际尺寸均为 **1254×1254**，未达到任务要求的 1024×1024。保留模型原始输出，未通过本地缩放替代。透明外围有少量红色孤立颗粒，icon-3 较明显；icon-2 底板占比约 82%，低于要求约 88%；icon-3 堆叠阴影比扁平要求略强。它们可供方案选择，尚不能当作严格符合生产尺寸的最终图标。
- 项目页列表行目测约 80px，比 DESIGN.md 的 40px 更疏；侧栏约 214px、右面板约 680px，为规格 232px／600px 的近似布局。三张界面的文字和控件整体也比 13px 级别偏大。最终实现仍以规格 token 和尺寸为准。
- 项目页保留任务要求的“逾期 2 天”，提示词另给详情截止日“11月4日”。若统一采用今日页的11月2日样例时间，这两个日期表达不一致；两张项目图为同布局的视觉概念参考，不能作为日期逻辑验收数据。
- 图内品牌强调色还用于部分选项卡和描边操作，与 DESIGN.md 的严格使用范围有近似偏差。没有更改规格或接口契约。

## 验证

任务 0 未指定构建或测试命令。本次执行原图文件验证，并逐张通过 `view_image` 目检；代码构建与应用测试不属于本次图片任务。

### 实际执行命令

在仓库根目录 PowerShell 执行以下命令，退出码 **0**：

```powershell
Add-Type -AssemblyName System.Drawing
$taskPngGuid = [Guid]'b96b3caf-0728-11d3-9d7b-0000f81ef32e'
$taskFiles = @('icons/icon-1.png','icons/icon-2.png','icons/icon-3.png','projects-light.png','projects-dark.png','today-light.png')
foreach ($taskRelative in $taskFiles) {
  $taskPath = Join-Path 'docs/spec/concepts' $taskRelative
  $taskName = [IO.Path]::GetFileNameWithoutExtension($taskRelative)
  $taskRecordName = if ($taskName -eq 'today-light') { 'today-light-correction' } else { $taskName }
  $taskRecord = Get-Content -LiteralPath ('docs/spec/concepts/generation/' + $taskRecordName + '.result.json') -Encoding UTF8 -Raw | ConvertFrom-Json
  $taskSource = if ($taskRecord.sourcePath) { $taskRecord.sourcePath } else { $taskRecord.source_path }
  $taskBitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $taskPath).Path)
  try {
    if ($taskBitmap.RawFormat.Guid -ne $taskPngGuid) { throw "Not PNG: $taskRelative" }
    $taskSize = "$($taskBitmap.Width)x$($taskBitmap.Height)"
    $taskAlpha = $taskBitmap.GetPixel(0,0).A
    if ($taskName -like 'icon-*' -and $taskAlpha -ne 0) { throw "Opaque icon corner: $taskRelative" }
    if ($taskName -notlike 'icon-*' -and $taskSize -ne '1536x1024') { throw "UI size mismatch: $taskRelative" }
  } finally { $taskBitmap.Dispose() }
  $taskHash = (Get-FileHash -LiteralPath $taskPath -Algorithm SHA256).Hash
  $taskSourceHash = (Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash
  if ($taskHash -ne $taskSourceHash) { throw "Source bytes differ: $taskRelative" }
  "$taskRelative | PNG | $taskSize | corner-alpha=$taskAlpha | SOURCE_MATCH"
  "SHA256=$taskHash"
}
'PNG_READABLE=6/6; ORIGINAL_BYTES=6/6; UI_SIZE=3/3'
'ICON_REQUEST_SIZE=0/3; actual=1254x1254; requested=1024x1024'
```

### 原样输出

```text
icons/icon-1.png | PNG | 1254x1254 | corner-alpha=0 | SOURCE_MATCH
SHA256=6DBBCE415AF5631881998619152BF463958565848007AFE1DA66621BDB613A4C
icons/icon-2.png | PNG | 1254x1254 | corner-alpha=0 | SOURCE_MATCH
SHA256=2F2AC651639092EA1E619AA3CE2EBA4BC6C31B0FE6A0D4451186C8E77EDD9D5C
icons/icon-3.png | PNG | 1254x1254 | corner-alpha=0 | SOURCE_MATCH
SHA256=5758B5E709ECC2F1C9A24D2E9AE2D0A541C68A63E168928B80074351EA45191B
projects-light.png | PNG | 1536x1024 | corner-alpha=255 | SOURCE_MATCH
SHA256=2BD710F85E40C900C972F89275A776A5235918D9BB029E50970AD055755CD0F3
projects-dark.png | PNG | 1536x1024 | corner-alpha=255 | SOURCE_MATCH
SHA256=628498BA809CED5A20BF7FB5122FFC1E34FC8AA76377E9A45C75BD1935561C08
today-light.png | PNG | 1536x1024 | corner-alpha=255 | SOURCE_MATCH
SHA256=C05CE269941F70A3626B5470BEE5AE0FFB7FDB1C00288A5BEB6105744DB6845A
PNG_READABLE=6/6; ORIGINAL_BYTES=6/6; UI_SIZE=3/3
ICON_REQUEST_SIZE=0/3; actual=1254x1254; requested=1024x1024
```

- PNG 可读取：6／6；项目与今日原图尺寸：3／3；图标透明角点：3／3。
- 与工具保存原图的 SHA-256 一致：6／6；不存在本地重排、合成或改画。
- 图标严格 1024×1024 验证：0／3，偏差如上。
- 目检：三图标方案可辨；项目深浅两图均包含9行项目、6个文件卡片，报价 ¥1,280／已收 ¥800／待收 ¥480、62.5%及两笔收款一致。今日页包含关注3项、分组项目、收入 ¥8,640、6根收入柱、5笔待收款与动态；最终侧栏逾期3、待收款5位置正确。没有将像素图片当作交互或业务逻辑测试。

## 给 Claude 的备注

- 请评审图标候选并选择方向；图标生产尺寸与透明边缘问题仍需在采用前处理。
- 项目深浅图用于比较同一画面的主题；今日页最终采用修正后的 `today-light.png`，其元数据在 [today-light-correction.result.json](../../spec/concepts/generation/today-light-correction.result.json)。初版结果已标记 superseded，并指向保留的初版文件。
- 写入范围为 `docs/spec/concepts/` 和本报告；新增依赖：无。未改动并行开发中的源码。
- 当前 DESIGN.md 已允许 AI 图标候选和概念图。本次没有发现需要改动 ARCHITECTURE.md 接口契约的冲突。

### 所用提示词（逐字）

#### icon-1

完整请求文件：[icon-1.request.json](../../spec/concepts/generation/icon-1.request.json)

```text
Use case: logo-brand
Asset type: Windows 桌面应用「客户工作台」图标候选，单张原生 1024×1024 PNG，方形画布。
Primary request: 方案一「朱印」。正面平视的一枚印章印面，朱红圆角方形 squircle 主体居中，占画布宽高约88%，圆角约22%。朱红颜色 #C94A12—#E0601E，暖白色阴刻的几何化抽象「客」字结构，方正、粗壮、清晰，像印章篆刻。抽象汉字结构即可，不强求可读汉字。
Style/medium: 高级、克制、现代、扁平的应用图标，几何轮廓，白色负形与朱红实体对比鲜明。整体干净，仅印面边缘极轻微印泥颗粒质感，不要做旧破损。
Composition/framing: 严格正视、无任何透视；主体约88%占比，均匀留边；粗壮的大形使16px和32px缩小后仍可辨认。周围真正透明背景，保留alpha。
Constraints: 仅生成一个完整图标；不含任何说明文字、标题、尺寸标记或水印；无手、无物理印章手柄、无立体倾斜、无地面、无落地投影。不要营销包装图或多方案拼图。输出PNG。
```

#### icon-2

完整请求文件：[icon-2.request.json](../../spec/concepts/generation/icon-2.request.json)

```text
Use case: logo-brand
Asset type: Windows 应用「客户工作台」图标候选方案2「文件夹 + 勾」，单张正方形 PNG，请输出 1024×1024 像素。
Primary request: 一个精致、简洁、适合正式发布 Windows 桌面应用的图标。居中的朱红圆角方形 squircle 底板占画布宽高约88%，四周留等距透明空白，背景真实透明。底板以 #C94A12 到 #E0601E 的朱红为主，扁平现代，仅极轻柔高光。正中一个简洁、饱满、米白色 #FFF7EB 文件夹轮廓，文件夹的前片上有一个朱红小对勾。文件夹与对勾之间有清楚的负空间，轮廓清晰，粗细足够在16px和32px缩小时辨认。
Composition/framing: 正面平视、完全正交、居中对称的应用图标构图，单个完整图标，不画多方案，不出现设备或底座。
Style/medium: 干净的二维扁平图标，克制的柔和高光，锐利清楚边缘，少量细节；温暖、安静、专业。
Color palette: 朱红 #C94A12—#E0601E 与米白色，除此不增加装饰色。
Constraints: 真正透明背景，保留alpha通道；无透视，无投影到地面，无外部光晕，无边框文字，无说明，无字母，无汉字，无水印。不要桌面截图，不要照片，不要3D渲染。
```

#### icon-3

完整请求文件：[icon-3.request.json](../../spec/concepts/generation/icon-3.request.json)

```text
Use case: logo-brand
Asset type: Windows desktop application icon concept for 客户工作台.
Generate ONE square 1024×1024 PNG image with a genuinely transparent background around the icon. A front-facing squircle tile occupies about 88% of the canvas, centered with even margins. The squircle is vermilion red #C94A12–#E0601E. In its center are exactly three slightly offset, overlapping ivory project cards, like stacked project-management cards. The top card has one short vermilion vertical bar at its left and exactly two thin gray horizontal lines representing text. No readable lettering. Flat modern graphic, crisp edges, clean geometry, restrained softness only, balanced proportions, strong immediately recognizable silhouette readable at 16px and 32px.
No perspective, no isometric view, no 3D extrusion, no ground shadow, no device, no caption, no watermark, no surrounding border, no extra symbols. The outer area must be truly transparent, not a drawn checkerboard.
```

#### projects-light

完整请求文件：[projects-light.request.json](../../spec/concepts/generation/projects-light.request.json)

```text
Use case: ui-mockup
Asset type: 客户工作台 v2 的高保真 Windows 桌面应用界面概念图，项目列表与右侧项目详情面板，浅色主题。
Primary request: 生成一张完整、平视、正交的真实产品截图。请求画布1536×1024像素，横版PNG。画面全部为应用UI，无外部留白、无设备边框、无透视、无手、无营销标题、水印。安静、利落、有温度，Linear的紧凑密度、Things 3的平静、Notion的暖中性色。文字清晰，全部简体中文。13px级别正文与20px页标题，不要手机UI或大字仪表盘。
Composition: 左侧栏232px，中间项目列表约704px，右侧项目详情面板600px，三个连续区域充满画布。页面内容沿顶部对齐。1px细边框，4px网格，8px控件圆角、12px卡片圆角，轻柔阴影仅用于右面板。
Palette: 主背景#FAFAF9，侧栏#F3F2EF，面板#FFFFFF，边框#E7E5E1，主文字#1C1917、次文字#57534E。唯一品牌强调色朱红#C94A12，只用于小朱印标志、主按钮、选中导航、链接、选中行左侧2px标线。状态/标签可用低饱和语义色，不要大面积彩色卡片、装饰渐变或玻璃拟态。
左侧栏: 顶部小朱印标志和“客户工作台”。细线图标导航“今日”“项目”“客户”“收入”“文件”“话术”，选中“项目”，朱红文字与淡朱红底。下方分组“视图”，条目“星标”“逾期 3”“待收款 5”；分组“标签”，小彩色圆点与“老客户”“餐饮”“加急”“品牌”。底部绿色小状态点“文件库正常”，以及“设置”。
中间: 页头“项目 24”，小分段控件“列表 | 看板”（列表选中），搜索框“搜索项目…”，朱红按钮“新建项目”。下一行筛选chip“全部状态”“标签”“截止日”“收款状态”。紧凑表格9行，列“项目名”“状态”“标签”“截止日”“金额”“收款”。星标放在项目名左侧。项目名单行，下方小圆首字头像与客户名；金额右对齐，等宽数字。第1行选中，浅暖灰底和左侧朱红细标线，项目“夏季新品海报设计”客户“林女士”，状态“进行中”淡蓝pill，标签“老客户”，截止日红色“逾期 2 天”，金额“¥1,280”，收款“¥800 / ¥1,280”与细灰色进度条。其余8行为“咖啡店菜单设计 / 山野咖啡 / 待确认 / 明天 / ¥960”“品牌标志升级 / 陈先生 / 洽谈中 / 11月6日 / ¥2,400”“双十一活动主图 / 小鹿花店 / 进行中 / 11月8日 / ¥880”“包装礼盒设计 / 青禾茶铺 / 已交付 / 11月10日 / ¥1,600”“门店开业海报 / 赵女士 / 已完成 / 11月12日 / ¥680”“产品详情页设计 / 森屿家居 / 进行中 / 11月14日 / ¥1,200”“节日宣传单 / 王先生 / 待确认 / 11月16日 / ¥480”“会员卡设计 / 拾光书店 / 已完成 / 无截止日 / ¥360”。状态pill：进行中蓝、待确认琥珀、洽谈中紫灰、已交付青、已完成绿。条目轻细分隔，不做彩色整行。
右面板: 白色、左边柔和阴影。顶部关闭、展开、更多小图标；标题“夏季新品海报设计”，客户圆头像“林”和链接“林女士”，状态下拉“进行中”，星标。紧凑双列属性“截止日 11月4日”“来源 淘宝”“订单号 202611020086”及复制图标，“标签 老客户 海报”。钱卡片有小标签“报价”和金额“¥1,280”，“成本 ¥200”“预计利润 ¥1,080”；下一行“已收 ¥800”“待收 ¥480”，细收款进度条显示62.5%。两条收款记录：“11月1日 微信 +¥500”“11月2日 支付宝 +¥300”。右侧边框按钮“记一笔”。下方选项卡“文件”“动态”“需求”，文件选中。文件工具行“添加文件”“打开文件夹”，并有网格/列表小图标。按“过程稿”“交付成品”分组，共6个文件卡片，3列2行：过程稿中“海报初稿.png”“海报修改.png”两张有设计感的海报缩略图和“海报源文件.psd”图标卡；交付成品中“最终海报.png”一张海报缩略图、“矢量素材.ai”“交付文件.pdf”图标卡。PSD、AI、PDF使用小型文件类型标识，文件名下有灰色大小时间。海报缩略图也由本次生图直接生成，所有文字和版面直接生成。
Avoid: 不要说明性标注、尺寸线、颜色色板、真实人像、emoji、霓虹色、大圆角、重阴影、过大的控件；不要添加未要求的页面。
```

#### projects-dark

完整请求文件：[projects-dark.request.json](../../spec/concepts/generation/projects-dark.request.json)

```text
Use case: style-transfer
Asset type: 客户工作台 v2，项目列表加项目详情面板，同一画面的深色主题高保真产品截图。
Input images: Image 1 is the edit target, the completed projects-light.png interface. Use exactly this UI as the source.
Primary request: 只把这张浅色桌面界面改为匹配的深色主题；保持同一1536×1024横版构图与PNG格式。全部版面、三栏尺寸、九行项目顺序、标题、中文文字、金额、日期、文件名、图标与6张文件卡片的位置保持原样。保留三张海报缩略图本身的颜色内容。不添加或删除任何UI。画面仍然是平视真实桌面应用截图，中文清晰，13px级紧凑密度。
Color transformation:
主区背景 #FAFAF9 → #141312。
侧栏 #F3F2EF → #1A1918。
白色面板、卡片、控件表面 → #1F1E1C。
表头/输入框次层底色 #262523，悬停与选中行 #2B2A27 / #33312E。
细边框 → #2F2D2A，强边框 #3D3A36。
主文字 → #F2F1EF，次文字 → #B5B1AB，辅助文字 → #7F7A74，清晰可读，不要浅灰字在浅底。
品牌强调色 #C94A12 → #FF8048，仅用于原图中同样的主按钮、小朱印、选中项目导航、链接与选中行2px竖线。主按钮文字用深色 #1F0E05。
状态pill保留语义：进行中蓝、待确认琥珀、洽谈中紫灰、已交付青、已完成绿；改为20%暗淡底与提亮文字，逾期文字仍红色，收款正数仍绿色。
钱卡片背景为#1F1E1C，保持“报价 ¥1,280”“成本 ¥200”“预计利润 ¥1,080”“已收 ¥800”“待收 ¥480”及62.5%细进度条、两笔收款、记一笔按钮。文件区分组“过程稿”“交付成品”、3海报+PSD+AI+PDF全部保留。
Constraints: 这是指定源图的主题编辑，必须保存所有几何布局、结构与数据；只更换UI表面和文字颜色。用轻微深色阴影与1px边界分层，不要装饰渐变、玻璃拟态、霓虹色、设备外壳、透视、手、说明性标注或水印。所有文字、版面和最终画面都由生图工具直接生成。
```

#### today-light

完整请求文件：[today-light.request.json](../../spec/concepts/generation/today-light.request.json)

```text
Use case: ui-mockup
Asset type: 客户工作台 v2 Windows 桌面应用“今日”页浅色主题高保真界面概念图。
Primary request: 生成一张像真实发布产品的精致、清晰、正面平视的完整应用截图，请求1536×1024像素横版PNG。画面全部是应用UI，无设备外壳、无外部背景、无透视、无手、无营销文字、无水印。所有文字直接由图片生成并使用简体中文。紧凑13px桌面UI，参考Linear的密度、Things 3的平静、Notion的温和，视觉方向“暖纸·朱印”。
Style: 1px细边框，4px间距网格，8px控件圆角、12px卡片圆角，清晰字重400/500/600，金额等宽数字。无彩色渐变卡、无玻璃拟态、无装饰大色块、无emoji图标、无重阴影。主背景#FAFAF9，侧栏#F3F2EF，卡片#FFFFFF，输入浅底#F5F4F2，边框#E7E5E1，主文字#1C1917，次文字#57534E。朱红强调色#C94A12只用于小应用标志、主按钮、选中导航、链接与规定的本月收入最后一根柱；其他颜色仅作为小型状态/标签语义标识。
Layout: 左侧固定232px导航，右侧主内容区有32px内边距。页头之下两栏，左主栏约760px、右栏约420px，中间24px间距。页面上下布局紧凑、安静、对齐精准。下方内容完整可见，不要大面积空白。
左侧栏: 顶部小朱红印章标志+“客户工作台”。16px细线图标导航“今日”“项目”“客户”“收入”“文件”“话术”，选中“今日”，朱红字与淡朱红底。分组“视图”，条目“星标”“逾期”右侧小计数“3”、“待收款”小计数“5”。分组“标签”，小彩色圆点与“老客户”“餐饮”“加急”“品牌”。底部绿色状态点“文件库正常”，以及齿轮图标“设置”。
页头: 大字“下午好”，旁边或下一行小日期“11月2日 周一”，下方一句“3 个项目进行中，2 个本周到期，还有 ¥1,280 待收”。右上朱红实底按钮“＋ 新建项目”。
左主栏第一组: 标题“需要关注”与数量“3”，右侧“查看全部”。三张横向白色细边框紧凑卡片垂直排列，每张有圆形姓名首字头像、项目名、客户小字、状态pill、到期chip与右对齐金额。
第一张：“夏季新品海报设计”，首字“林”、客户“林女士”，淡蓝“进行中”，淡红chip“逾期 2 天”，金额“¥1,280”。
第二张：“品牌包装修改”，首字“陈”、客户“陈先生”，淡琥珀“待确认”，淡红chip“逾期 1 天”，金额“¥860”。
第三张：“咖啡店菜单设计”，首字“山”、客户“山野咖啡”，淡蓝“进行中”，琥珀chip“明天”，金额“¥960”。
左主栏第二组: 标题“进行中”右侧小链接“全部项目”。按状态分成3个紧凑小组，分组标题“进行中 3”“待确认 2”“洽谈中 2”，每行32–40px高度、细灰分隔线、小圆首字头像、项目名、客户小字、右侧状态下拉和灰色日期。示例行：“双十一活动主图 / 小鹿花店 / 11月8日”“产品详情页设计 / 森屿家居 / 11月14日”“包装礼盒设计 / 青禾茶铺 / 11月10日”；待确认“节日宣传单 / 王先生”“门店物料设计 / 赵女士”；洽谈中“品牌标志升级 / 陈先生”“会员卡设计 / 拾光书店”。小状态点使用进行中蓝、待确认琥珀、洽谈中紫灰。
右栏顶部白色细边框卡片: 标题“本月收入”，大号等宽数字“¥8,640”，下面“较上月 +12%”小字，增长只用小型绿色文本。卡片下半部6根细迷你柱，高度有起伏，前5根暖浅灰、最后1根朱红，横轴小字“6月 7月 8月 9月 10月 11月”，无复杂坐标网格。
右栏中部白色细边框卡片: 标题“待收款”，5行，客户/项目两行小字、右对齐金额，每行末尾一个中性色细边框小按钮“记一笔”。五行数据：“林女士 / 夏季新品海报设计 / ¥480”“山野咖啡 / 咖啡店菜单设计 / ¥300”“陈先生 / 品牌包装修改 / ¥240”“小鹿花店 / 双十一活动主图 / ¥160”“王先生 / 节日宣传单 / ¥100”。金额总计¥1,280，列表层级清楚。
右栏底部白色细边框卡片: 标题“最近动态”，5条细线时间轴，每条小图标、灰色系统描述和小时间，包含“林女士 · 收到微信付款 ¥500”“小鹿花店 · 添加了 3 个文件”“山野咖啡 · 状态改为待确认”“青禾茶铺 · 已交付包装礼盒”“陈先生 · 更新了项目需求”，时间“10分钟前”“35分钟前”“1小时前”“2小时前”“今天 09:30”。
Constraints: 高保真可实现UI，不要概念艺术风，不要注释、颜色色板、尺寸线、展示海报标题。保留完整六导航和两栏主体，中文字清晰自然，金额准确，全部元素直接生成。
```

#### today-light-correction

完整请求文件：[today-light-correction.request.json](../../spec/concepts/generation/today-light-correction.request.json)

```text
Use case: precise-object-edit
Input image: the attached today-light.png is the edit target.
请只修正这张“客户工作台”今日页截图左侧栏的一处计数位置：在“视图”分组中，把“星标”行右边灰色小徽标“3”移到下一行“逾期”的右侧，让“星标”行没有数字，“逾期”行右侧显示“3”，“待收款”行右侧仍然是“5”。灰色小徽标样式、大小和横向位置不变，只下移一行。
除此之外保持原图所有像素构图、侧栏、文字、字号、颜色、项目、金额、头像、图表、列表、留白、按钮与全部位置不变。主区“需要关注”标题旁的“3”以及“进行中 3”等其它数字完全保留。保持1536×1024横版PNG，白色背景不透明，无水印。只做这一处计数徽标位置编辑，所有最终内容仍由图片模型生成。
```
