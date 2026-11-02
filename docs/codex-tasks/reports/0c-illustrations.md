# 任务 0c：正式插画素材交付

## 完成

- 已生成并导出全部 **19/19** 个指定文件：3 张时段横幅、1 张欢迎图、7 张透明团子空状态、8 张示例设计稿。
- 全部使用内置生图工具逐张生成。插画角色与画风参考 `A-today.png`，商业设计稿参考 `A-projects.png`。所有画面、文字与版式来自生图工具；本地仅做任务授权的裁切、缩放、透明边缘清理与 WebP 导出。
- 最终文件总大小：1049334 字节。

| 文件路径 | 最终尺寸 | 大小（字节） | WebP 质量 | 请求原图 → 实际原图 |
|---|---:|---:|---:|---:|
| `src/assets/illustrations/hero-morning.webp` | 1536×600 | 67672 | 82 | 1536×1024 → 1536×1024 |
| `src/assets/illustrations/hero-afternoon.webp` | 1536×600 | 85096 | 82 | 1536×1024 → 1536×1024 |
| `src/assets/illustrations/hero-night.webp` | 1536×600 | 88048 | 82 | 1536×1024 → 1536×1024 |
| `src/assets/illustrations/welcome.webp` | 800×800 | 68488 | 82 | 1024×1024 → 1254×1254 |
| `src/assets/illustrations/empty-today.webp` | 480×480 | 30138 | 88 | 1024×1024 → 1254×1254 |
| `src/assets/illustrations/empty-projects.webp` | 480×480 | 24918 | 88 | 1024×1024 → 1254×1254 |
| `src/assets/illustrations/empty-clients.webp` | 480×480 | 31550 | 88 | 1024×1024 → 1254×1254 |
| `src/assets/illustrations/empty-files.webp` | 480×480 | 32022 | 88 | 1024×1024 → 1254×1254 |
| `src/assets/illustrations/empty-snippets.webp` | 480×480 | 29050 | 88 | 1024×1024 → 1254×1254 |
| `src/assets/illustrations/empty-search.webp` | 480×480 | 35108 | 88 | 1024×1024 → 1254×1254 |
| `src/assets/illustrations/library-offline.webp` | 480×480 | 39148 | 88 | 1024×1024 → 1254×1254 |
| `src/api/mock/assets/poster-summer-drink.webp` | 800×800 | 91192 | 82 | 1024×1024 → 1254×1254 |
| `src/api/mock/assets/brand-logo-upgrade.webp` | 800×800 | 23392 | 82 | 1024×1024 → 1254×1254 |
| `src/api/mock/assets/tea-gift-box.webp` | 800×800 | 52950 | 82 | 1024×1024 → 1254×1254 |
| `src/api/mock/assets/double11-flowers.webp` | 800×800 | 55390 | 82 | 1024×1024 → 1254×1254 |
| `src/api/mock/assets/cafe-menu.webp` | 800×800 | 92888 | 82 | 1024×1024 → 1254×1254 |
| `src/api/mock/assets/store-opening.webp` | 800×800 | 60636 | 82 | 1024×1024 → 1254×1254 |
| `src/api/mock/assets/member-card.webp` | 800×800 | 38080 | 82 | 1024×1024 → 1254×1254 |
| `src/api/mock/assets/product-detail-sofa.webp` | 800×800 | 103568 | 82 | 1024×1024 → 1254×1254 |

### 生成与导出记录

- 每次调用生成 1 张，共 22 次成功调用；最终采用 19 张，清晨图额外 3 张构图/姿态修正原图保留归档。不存在待恢复的旧任务，也没有对状态不明的请求重新提交。
- 横幅原图均为 PNG、1536×1024。最终清晨/午后裁切框为 `(0,210,1536,810)`，夜景为 `(0,230,1536,830)`；三张均直接裁成 1536×600，WebP quality 82、method 6，未拉伸。清晨最终已修正为站在窗边，人物、咖啡手机与伸懒腰的猫都完整。
- 欢迎图和 8 张设计稿缩放至 800×800，WebP quality 82、method 6、Lanczos。7 张团子图统一 480×480、WebP quality 88、method 6，保留 alpha；清理低 alpha 彩色噪点及微小孤立杂点，透明边缘留白完整。具体裁切框与透明阈值见逐份 manifest。
- 请求明确设置的参数：完整提示词、参考图路径、`transparent_background`（7 张团子为 true，其余为 false）。内置工具未提供独立尺寸、生成质量、数量、输出格式或异步模式参数；尺寸和单张要求写入提示词，实际原图格式与尺寸通过 Pillow 读取。
- 内置工具未返回实际模型、生成质量档位、usage、价格或币种，均无法确认。**费用和币种无法查询，未核对账单，不能确认实际扣费，也没有以其他模型/尺寸价格估算或声称免费。**
- 工具未公开供应商分组、异步任务接口、幂等键、服务端任务号、状态查询或下载入口；无法确认供应商的异步支持。本次按任务明确授权直接调用内置工具，每份提交前保存请求，成功返回后保存 output_hint 与原始 PNG。未声称采用供应商异步模式。

## 未完成 / 偏离规格

- 未完成项：无。19 个最终文件的名称、尺寸、格式、大小与透明要求全部达标。
- 方形原图在提示词请求 1024×1024，工具实际输出为 1254×1254；原文件如实存档，最终按要求导出 800×800 或 480×480。没有把缩放版本冒充原图。
- `ARCHITECTURE.md` §7 对 Mock 图片要求每张 <120KB，而任务与 DESIGN.md 为 ≤150KB；按较严限制执行，8 张均 <120000 字节，没有修改规格或接口。

## 验证

- 主验证：PowerShell UTF-8 here-string `@'…'@ | python -`，Pillow 逐项断言名称、WebP 解码、尺寸、大小上限、原图/请求/结果存档、提示词与请求一致、SHA256，以及 7 张 RGBA 的透明四边，退出码 `0`。原样结果：

```text
PASS src/assets/illustrations/hero-morning.webp | 1536x600 | 67672 bytes
PASS src/assets/illustrations/hero-afternoon.webp | 1536x600 | 85096 bytes
PASS src/assets/illustrations/hero-night.webp | 1536x600 | 88048 bytes
PASS src/assets/illustrations/welcome.webp | 800x800 | 68488 bytes
PASS src/assets/illustrations/empty-today.webp | 480x480 | 30138 bytes
PASS src/assets/illustrations/empty-projects.webp | 480x480 | 24918 bytes
PASS src/assets/illustrations/empty-clients.webp | 480x480 | 31550 bytes
PASS src/assets/illustrations/empty-files.webp | 480x480 | 32022 bytes
PASS src/assets/illustrations/empty-snippets.webp | 480x480 | 29050 bytes
PASS src/assets/illustrations/empty-search.webp | 480x480 | 35108 bytes
PASS src/assets/illustrations/library-offline.webp | 480x480 | 39148 bytes
PASS src/api/mock/assets/poster-summer-drink.webp | 800x800 | 91192 bytes
PASS src/api/mock/assets/brand-logo-upgrade.webp | 800x800 | 23392 bytes
PASS src/api/mock/assets/tea-gift-box.webp | 800x800 | 52950 bytes
PASS src/api/mock/assets/double11-flowers.webp | 800x800 | 55390 bytes
PASS src/api/mock/assets/cafe-menu.webp | 800x800 | 92888 bytes
PASS src/api/mock/assets/store-opening.webp | 800x800 | 60636 bytes
PASS src/api/mock/assets/member-card.webp | 800x800 | 38080 bytes
PASS src/api/mock/assets/product-detail-sofa.webp | 800x800 | 103568 bytes
PASS 19/19 WEBP: names, decoding, dimensions, byte limits, original/request/result archives, prompt equality and SHA256; 7/7 RGBA and transparent borders.
```

- 独立复核：逐张目视人物与团子一致性、横幅留白/主体完整性、猫图浅深底透明边缘、商业设计稿中文字与版式，并检查高 alpha 彩噪。退出码 `0`，结果原文：

```text
PASS 19/19 files: names, dimensions, WEBP decoding, byte limits; 7/7 transparent alpha, clear borders and chromatic noise checks.
```

- 可重复运行的解码/尺寸/字节核验命令已保存到 `docs/spec/concepts/v2/generation/0c/verification-command.txt`；执行结果原文：

```text
PASS 19/19 archived assets: WEBP decoding, dimensions and byte counts.
```

## 给 Claude 的备注

- 只新增本任务允许目录中的素材、原图、请求/结果/提示词存档与本报告；没有修改应用代码，没有新增依赖，没有执行 git commit / push / 切分支 / reset。已有 SVG 占位图保留。
- 可直接按任务文件名引用这些 WebP。总清单与 SHA256：`docs/spec/concepts/v2/generation/0c/manifest.json`；验证数据：`docs/spec/concepts/v2/generation/0c/verification.json`。
- 三组完整存档位于 `generation/0c/heroes/`、`generation/0c/mascots/`、`generation/0c/mock/`。团子浅深底预览：`generation/0c/mascots/qa-light-dark.jpg`。

## 每个文件的原图、参数与完整提示词

### 1. hero-morning

- 最终文件：`src/assets/illustrations/hero-morning.webp`（1536×600，67672 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/heroes/hero-morning-final.original.png`（1536×1024，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/heroes/hero-morning-final.request.json` / `docs/spec/concepts/v2/generation/0c/heroes/hero-morning-final.result.json`。
- 导出参数：`{"format":"webp","quality":82,"method":6}`。

```text
Create ONE polished Japanese anime studio illustration, requested resolution1536x1024. Reference image1 A-today defines exact character identity and paint style; reference image2 afternoon defines the REQUIRED SMALL SUBJECT SCALE and pulled-back wide composition. Do NOT reproduce any UI.
Keep exactly the same young adult female designer: long soft chestnut hair half tied, white large headphones, pale lavender cardigan over white shirt, warm brown eyes. Same chubby orange striped tabby with white muzzle/chest/paws.
Create early MORNING variation of reference2: gold and pink dawn through windows, tidy desk with closed sketchbook and swatch fan. The woman is STANDING upright behind a waist-height desk, NO CHAIR. She holds steaming coffee in her left hand and checks smartphone in right, pleasant morning expression. Her head and shoulders, both hands and cup/phone fully visible above waist-level desk; lower body hidden behind desk. The same orange cat stretches on the desktop beside her, fully visible.
MOST IMPORTANT: Use a very pulled-back WIDE establishing shot. Woman visible above desk only350pixels tall. Top of her hair at y=330, desktop at y=690, cat entire body in y=590..740. Her entire silhouette above desk and cat/props should all fit y=300..800. Main scene SMALL, same scale as reference2 or smaller. Do not enlarge the woman to fill canvas. The top250pixels and bottom220pixels contain only plain expendable background and desk front. ALL action in RIGHT55percent. LEFT45percent is clean empty pale gold/lavender wall gradient for text overlay, no props. Natural anatomy, no text, no UI, no watermark.
```

### 2. hero-afternoon

- 最终文件：`src/assets/illustrations/hero-afternoon.webp`（1536×600，85096 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/heroes/hero-afternoon.original.png`（1536×1024，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/heroes/hero-afternoon.request.json` / `docs/spec/concepts/v2/generation/0c/heroes/hero-afternoon.result.json`。
- 导出参数：`{"format":"webp","quality":82,"method":6}`。

```text
Use case: illustration-story. Create a finished standalone illustration asset for a bright young designer's desktop app, not an app screenshot or UI. The attached A-today.png is a style and character reference only: match exactly the young adult female designer in its top banner, soft chestnut brown long hair loosely half tied up, warm brown eyes, large white over-ear headphones, pale lavender cardigan over white top, gentle expressive anime face. Match its sunlit Japanese anime illustration technique, delicate clean linework, airy color, refined soft painted lighting, restrained lavender and sky blue accents, believable hands. The same mascot Dango is a plump orange tabby cat with warm orange striped coat, white muzzle/chest and white paws, tiny pink nose. All subjects and decorative elements must be generated by the image model. No app interface, frame, navigation, greeting, button, watermark or caption.
Requested canvas: 1536x1024 landscape. Composition is essential: reserve leftmost 45 percent as extremely clean, softly graded empty low-detail atmosphere. Put ALL character, desk, cat and important props in rightmost 55 percent. Compose like an ultrawide banner within the middle of the canvas: keep the woman's full head/hair/headphones, hands, cat and necessary props entirely inside y=180..780, with generous upper and lower expendable atmosphere so a 1536x600 horizontal crop retains the complete key action. Her face around x=1120,y=360, desk/cat around y=650. No vertical divide; left fades naturally to open soft background.
Scene: the same afternoon studio as the reference hero, clear blue sky and distant city skyline through broad windows, warm afternoon sunshine and leafy green plant accents only on the right. She wears the exact white over-ear headphones and pale lavender cardigan over white top while drawing with a stylus on a slanted pen display tablet. A few refined floral poster drafts and an open color swatch fan lie on the desk. Dango sleeps curled comfortably at the far right corner of the desk. Friendly focused expression, same recognizable woman and cat. Match reference illustration rather than copying UI. Premium delicate anime detail concentrated on right; left 45 percent pale lavender-blue softly illuminated empty atmosphere. No readable words.
REFRAMING REQUIREMENT: Wide establishing shot, camera pulled well back. The woman and desk must be noticeably smaller than the reference, not a portrait or medium shot. The entire important scene (headphones through cat paws and swatch cards) occupies at most 56% of canvas height, centered vertically. The TOP 210 pixels and BOTTOM 210 pixels contain only expendable continuation of sky/wall and desk front. All subject silhouettes fit within the central 600-pixel high horizontal band. No physical banner frame or margins.
```

### 3. hero-night

- 最终文件：`src/assets/illustrations/hero-night.webp`（1536×600，88048 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/heroes/hero-night.original.png`（1536×1024，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/heroes/hero-night.request.json` / `docs/spec/concepts/v2/generation/0c/heroes/hero-night.result.json`。
- 导出参数：`{"format":"webp","quality":82,"method":6}`。

```text
Use case: illustration-story. Create a finished standalone illustration asset for a bright young designer's desktop app, not an app screenshot or UI. The attached A-today.png is a style and character reference only: match exactly the young adult female designer in its top banner, soft chestnut brown long hair loosely half tied up, warm brown eyes, large white over-ear headphones, pale lavender cardigan over white top, gentle expressive anime face. Match its sunlit Japanese anime illustration technique, delicate clean linework, airy color, refined soft painted lighting, restrained lavender and sky blue accents, believable hands. The same mascot Dango is a plump orange tabby cat with warm orange striped coat, white muzzle/chest and white paws, tiny pink nose. All subjects and decorative elements must be generated by the image model. No app interface, frame, navigation, greeting, button, watermark or caption.
Requested canvas: 1536x1024 landscape. Composition is essential: reserve leftmost 45 percent as extremely clean, softly graded empty low-detail atmosphere. Put ALL character, desk, cat and important props in rightmost 55 percent. Compose like an ultrawide banner within the middle of the canvas: keep the woman's full head/hair/headphones, hands, cat and necessary props entirely inside y=180..780, with generous upper and lower expendable atmosphere so a 1536x600 horizontal crop retains the complete key action. Her face around x=1120,y=360, desk/cat around y=650. No vertical divide; left fades naturally to open soft background.
Scene: night-time version of the same designer studio, deep blue and violet palette, starry sky and distant city lights through windows on the right. A warm desk lamp illuminates her face, pale lavender cardigan, white inner top, drawing desk and finished floral artwork on a monitor. She relaxes back and stretches her arms gently above and slightly beside her head after finishing work; fit all raised hands and hair fully within the central safe crop y=180..780. Dango curls up sleepily beside her thighs on the chair or cushioned seat at the lower right, clearly visible in warm light. Peaceful end-of-day mood. Keep night sky truly dark navy/lavender while her face and desk remain clear and luminous. Left 45 percent is smooth dark indigo-blue atmospheric negative space without objects, lights or text.
REFRAMING REQUIREMENT: A pulled-back wide establishing shot. Show the woman and chair/desk at modest scale. Entire silhouette from fingertips to curled cat must fit inside a horizontal band no more than 56% of the image height, centered vertically. Upper and lower 210 pixels show only expendable night wall/sky or plain desk front. Avoid large foreground subjects. No physical banner frame.
```

### 4. welcome

- 最终文件：`src/assets/illustrations/welcome.webp`（800×800，68488 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/heroes/welcome.original.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/heroes/welcome.request.json` / `docs/spec/concepts/v2/generation/0c/heroes/welcome.result.json`。
- 导出参数：`{"format":"webp","quality":82,"method":6}`。

```text
Use case: illustration-story. Create a finished standalone illustration asset for a bright young designer's desktop app, not an app screenshot or UI. The attached A-today.png is a style and character reference only: match exactly the young adult female designer in its top banner, soft chestnut brown long hair loosely half tied up, warm brown eyes, large white over-ear headphones, pale lavender cardigan over white top, gentle expressive anime face. Match its sunlit Japanese anime illustration technique, delicate clean linework, airy color, refined soft painted lighting, restrained lavender and sky blue accents, believable hands. The same mascot Dango is a plump orange tabby cat with warm orange striped coat, white muzzle/chest and white paws, tiny pink nose. All subjects and decorative elements must be generated by the image model. No app interface, frame, navigation, greeting, button, watermark or caption.
Requested canvas: 1024x1024 square. Centered welcoming composition with generous clean empty margins all around, no text. The same young adult woman sits comfortably on floor in front of a few neat cardboard moving boxes and pastel lavender/sky blue file folders. She smiles warmly while placing a neat stack of beautifully illustrated design sheets into one large open lavender portfolio folder. Keep hands anatomically natural and action easy to read. Dango sits immediately beside her, tilting his head curiously, fully visible. Background is very pale sky-blue/lavender gradient with two or three soft white clouds and bright airy light. Clearly defined silhouette, polished sunlit Japanese anime illustration, delicate linework, gentle lavender and sky-blue accents. All main elements fully inside the frame, sparse background, refined and uplifting first-run welcome illustration.
```

### 5. empty-today

- 最终文件：`src/assets/illustrations/empty-today.webp`（480×480，30138 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mascots/empty-today.original.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mascots/empty-today.request.json` / `docs/spec/concepts/v2/generation/0c/mascots/empty-today.result.json`。
- 导出参数：`{"format":"WebP","quality":88,"method":6,"alpha":true,"sourceAlphaClearThreshold":12,"minimumConnectedComponentPixels":32,"sourceCrop":[89,174,1165,1033],"subjectMaxSide":416,"canvas":[480,480],"resample":"Lanczos","finalAlphaClearThreshold":2}`。

```text
Use case: illustration-story.
正式应用空状态插画素材，单张方形1024×1024。参考图仅用于提取横幅最右侧那只橘猫“团子”的角色外观和晴空主题日系动漫画风；这是新绘的单只吉祥物插画，不要重现参考图中的软件界面、女主角、文字或横幅。
团子角色必须统一：圆滚滚的橘色短毛虎斑猫，暖橙色毛发、深橘棕色条纹、额头M纹、小三角耳、奶白色嘴鼻区与胸腹、奶白色小爪、条纹粗尾巴，Q版大头短腿，脸型柔软，干净细腻轮廓、柔和动漫赛璐璐与轻柔渐变，温暖可爱。少量道具用淡紫与天蓝，不能变成另一只猫。
本张动作与道具：团子侧卧在一小段浅紫色窗台上晒太阳睡觉，闭着眼微笑，前爪轻轻交叠，橘色条纹尾巴卷到身体旁。右上方一枚小小的温暖太阳作为独立点缀。窗台只是一个小道具，不要整扇窗户，不要房间或背景。
构图：单只猫和指定少量道具居中，完整收进画面，在四周保留约10%的透明安全边距，主体连同道具占画幅约75%，线条清楚，细节适合缩小到160像素高使用。背景必须是真实透明alpha，背景完全空白透明，无不透明底色、无棋盘格、无白色描边贴纸边、无厚投影、无光晕、无颗粒、无漂浮噪点、无水印。不添加任何未要求的物体或文字。
画面完全无文字。
```

### 6. empty-projects

- 最终文件：`src/assets/illustrations/empty-projects.webp`（480×480，24918 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mascots/empty-projects.original.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mascots/empty-projects.request.json` / `docs/spec/concepts/v2/generation/0c/mascots/empty-projects.result.json`。
- 导出参数：`{"format":"WebP","quality":88,"method":6,"alpha":true,"sourceAlphaClearThreshold":12,"minimumConnectedComponentPixels":32,"sourceCrop":[44,276,1214,1073],"subjectMaxSide":416,"canvas":[480,480],"resample":"Lanczos","finalAlphaClearThreshold":2}`。

```text
Use case: illustration-story.
正式应用空状态插画素材，单张方形1024×1024。参考图仅用于提取横幅最右侧那只橘猫“团子”的角色外观和晴空主题日系动漫画风；这是新绘的单只吉祥物插画，不要重现参考图中的软件界面、女主角、文字或横幅。
团子角色必须统一：圆滚滚的橘色短毛虎斑猫，暖橙色毛发、深橘棕色条纹、额头M纹、小三角耳、奶白色嘴鼻区与胸腹、奶白色小爪、条纹粗尾巴，Q版大头短腿，脸型柔软，干净细腻轮廓、柔和动漫赛璐璐与轻柔渐变，温暖可爱。少量道具用淡紫与天蓝，不能变成另一只猫。
本张动作与道具：团子用两只前爪推着一个比身体略小的空牛皮纸箱，身体略向前倾，轻松可爱，纸箱开口朝上，可以清楚看到里面是空的。箱子没有文字，边角点缀一小块淡紫色胶带。
构图：单只猫和指定少量道具居中，完整收进画面，在四周保留约10%的透明安全边距，主体连同道具占画幅约75%，线条清楚，细节适合缩小到160像素高使用。背景必须是真实透明alpha，背景完全空白透明，无不透明底色、无棋盘格、无白色描边贴纸边、无厚投影、无光晕、无颗粒、无漂浮噪点、无水印。不添加任何未要求的物体或文字。
画面完全无文字。
```

### 7. empty-clients

- 最终文件：`src/assets/illustrations/empty-clients.webp`（480×480，31550 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mascots/empty-clients.original.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mascots/empty-clients.request.json` / `docs/spec/concepts/v2/generation/0c/mascots/empty-clients.result.json`。
- 导出参数：`{"format":"WebP","quality":88,"method":6,"alpha":true,"sourceAlphaClearThreshold":12,"minimumConnectedComponentPixels":32,"sourceCrop":[63,193,1161,1097],"subjectMaxSide":416,"canvas":[480,480],"resample":"Lanczos","finalAlphaClearThreshold":2}`。

```text
Use case: illustration-story.
正式应用空状态插画素材，单张方形1024×1024。参考图仅用于提取横幅最右侧那只橘猫“团子”的角色外观和晴空主题日系动漫画风；这是新绘的单只吉祥物插画，不要重现参考图中的软件界面、女主角、文字或横幅。
团子角色必须统一：圆滚滚的橘色短毛虎斑猫，暖橙色毛发、深橘棕色条纹、额头M纹、小三角耳、奶白色嘴鼻区与胸腹、奶白色小爪、条纹粗尾巴，Q版大头短腿，脸型柔软，干净细腻轮廓、柔和动漫赛璐璐与轻柔渐变，温暖可爱。少量道具用淡紫与天蓝，不能变成另一只猫。
本张动作与道具：团子坐着，笑眯眯地举着一面天蓝色小旗，旗上清楚地写着且仅写着“Hi”，H大写i小写。旗杆由一只前爪稳稳拿着，另一只前爪自然落在胸前。
构图：单只猫和指定少量道具居中，完整收进画面，在四周保留约10%的透明安全边距，主体连同道具占画幅约75%，线条清楚，细节适合缩小到160像素高使用。背景必须是真实透明alpha，背景完全空白透明，无不透明底色、无棋盘格、无白色描边贴纸边、无厚投影、无光晕、无颗粒、无漂浮噪点、无水印。不添加任何未要求的物体或文字。
唯一文字必须准确写作 Hi。
```

### 8. empty-files

- 最终文件：`src/assets/illustrations/empty-files.webp`（480×480，32022 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mascots/empty-files.original.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mascots/empty-files.request.json` / `docs/spec/concepts/v2/generation/0c/mascots/empty-files.result.json`。
- 导出参数：`{"format":"WebP","quality":88,"method":6,"alpha":true,"sourceAlphaClearThreshold":12,"minimumConnectedComponentPixels":32,"sourceCrop":[175,128,1084,1085],"subjectMaxSide":416,"canvas":[480,480],"resample":"Lanczos","finalAlphaClearThreshold":2}`。

```text
Use case: illustration-story.
正式应用空状态插画素材，单张方形1024×1024。参考图仅用于提取横幅最右侧那只橘猫“团子”的角色外观和晴空主题日系动漫画风；这是新绘的单只吉祥物插画，不要重现参考图中的软件界面、女主角、文字或横幅。
团子角色必须统一：圆滚滚的橘色短毛虎斑猫，暖橙色毛发、深橘棕色条纹、额头M纹、小三角耳、奶白色嘴鼻区与胸腹、奶白色小爪、条纹粗尾巴，Q版大头短腿，脸型柔软，干净细腻轮廓、柔和动漫赛璐璐与轻柔渐变，温暖可爱。少量道具用淡紫与天蓝，不能变成另一只猫。
本张动作与道具：团子从一个打开的淡紫色空文件夹里探出头和两只小前爪，文件夹内没有纸张，圆滚滚身体部分被文件夹遮挡，露出可爱的卷尾巴，带点好奇。文件夹没有文字。
构图：单只猫和指定少量道具居中，完整收进画面，在四周保留约10%的透明安全边距，主体连同道具占画幅约75%，线条清楚，细节适合缩小到160像素高使用。背景必须是真实透明alpha，背景完全空白透明，无不透明底色、无棋盘格、无白色描边贴纸边、无厚投影、无光晕、无颗粒、无漂浮噪点、无水印。不添加任何未要求的物体或文字。
画面完全无文字。
```

### 9. empty-snippets

- 最终文件：`src/assets/illustrations/empty-snippets.webp`（480×480，29050 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mascots/empty-snippets.original.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mascots/empty-snippets.request.json` / `docs/spec/concepts/v2/generation/0c/mascots/empty-snippets.result.json`。
- 导出参数：`{"format":"WebP","quality":88,"method":6,"alpha":true,"sourceAlphaClearThreshold":12,"minimumConnectedComponentPixels":32,"sourceCrop":[139,177,1168,1070],"subjectMaxSide":416,"canvas":[480,480],"resample":"Lanczos","finalAlphaClearThreshold":2}`。

```text
Use case: illustration-story.
正式应用空状态插画素材，单张方形1024×1024。参考图仅用于提取横幅最右侧那只橘猫“团子”的角色外观和晴空主题日系动漫画风；这是新绘的单只吉祥物插画，不要重现参考图中的软件界面、女主角、文字或横幅。
团子角色必须统一：圆滚滚的橘色短毛虎斑猫，暖橙色毛发、深橘棕色条纹、额头M纹、小三角耳、奶白色嘴鼻区与胸腹、奶白色小爪、条纹粗尾巴，Q版大头短腿，脸型柔软，干净细腻轮廓、柔和动漫赛璐璐与轻柔渐变，温暖可爱。少量道具用淡紫与天蓝，不能变成另一只猫。
本张动作与道具：团子坐着，嘴边轻轻叼住一个圆润的天蓝色空白对话气泡的尾尖，气泡是无字的白色内部、淡天蓝色边缘，像轻盈的小道具，不挡住团子的眼睛和大部分脸。
构图：单只猫和指定少量道具居中，完整收进画面，在四周保留约10%的透明安全边距，主体连同道具占画幅约75%，线条清楚，细节适合缩小到160像素高使用。背景必须是真实透明alpha，背景完全空白透明，无不透明底色、无棋盘格、无白色描边贴纸边、无厚投影、无光晕、无颗粒、无漂浮噪点、无水印。不添加任何未要求的物体或文字。
画面完全无文字。
```

### 10. empty-search

- 最终文件：`src/assets/illustrations/empty-search.webp`（480×480，35108 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mascots/empty-search.original.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mascots/empty-search.request.json` / `docs/spec/concepts/v2/generation/0c/mascots/empty-search.result.json`。
- 导出参数：`{"format":"WebP","quality":88,"method":6,"alpha":true,"sourceAlphaClearThreshold":12,"minimumConnectedComponentPixels":32,"sourceCrop":[96,89,1174,1112],"subjectMaxSide":416,"canvas":[480,480],"resample":"Lanczos","finalAlphaClearThreshold":2}`。

```text
Use case: illustration-story.
正式应用空状态插画素材，单张方形1024×1024。参考图仅用于提取横幅最右侧那只橘猫“团子”的角色外观和晴空主题日系动漫画风；这是新绘的单只吉祥物插画，不要重现参考图中的软件界面、女主角、文字或横幅。
团子角色必须统一：圆滚滚的橘色短毛虎斑猫，暖橙色毛发、深橘棕色条纹、额头M纹、小三角耳、奶白色嘴鼻区与胸腹、奶白色小爪、条纹粗尾巴，Q版大头短腿，脸型柔软，干净细腻轮廓、柔和动漫赛璐璐与轻柔渐变，温暖可爱。少量道具用淡紫与天蓝，不能变成另一只猫。
本张动作与道具：团子蹲坐着，前爪拿着一个淡紫色柄的放大镜，认真地歪头寻找，放大镜靠近一只眼睛但两只眼睛都可辨认，眉眼专注可爱，圆滚尾巴自然卷起。
构图：单只猫和指定少量道具居中，完整收进画面，在四周保留约10%的透明安全边距，主体连同道具占画幅约75%，线条清楚，细节适合缩小到160像素高使用。背景必须是真实透明alpha，背景完全空白透明，无不透明底色、无棋盘格、无白色描边贴纸边、无厚投影、无光晕、无颗粒、无漂浮噪点、无水印。不添加任何未要求的物体或文字。
画面完全无文字。
```

### 11. library-offline

- 最终文件：`src/assets/illustrations/library-offline.webp`（480×480，39148 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mascots/library-offline.original.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mascots/library-offline.request.json` / `docs/spec/concepts/v2/generation/0c/mascots/library-offline.result.json`。
- 导出参数：`{"format":"WebP","quality":88,"method":6,"alpha":true,"sourceAlphaClearThreshold":12,"minimumConnectedComponentPixels":32,"sourceCrop":[172,128,1099,1160],"subjectMaxSide":416,"canvas":[480,480],"resample":"Lanczos","finalAlphaClearThreshold":2}`。

```text
Use case: illustration-story.
正式应用空状态插画素材，单张方形1024×1024。参考图仅用于提取横幅最右侧那只橘猫“团子”的角色外观和晴空主题日系动漫画风；这是新绘的单只吉祥物插画，不要重现参考图中的软件界面、女主角、文字或横幅。
团子角色必须统一：圆滚滚的橘色短毛虎斑猫，暖橙色毛发、深橘棕色条纹、额头M纹、小三角耳、奶白色嘴鼻区与胸腹、奶白色小爪、条纹粗尾巴，Q版大头短腿，脸型柔软，干净细腻轮廓、柔和动漫赛璐璐与轻柔渐变，温暖可爱。少量道具用淡紫与天蓝，不能变成另一只猫。
本张动作与道具：团子坐着，两只前爪抱住一个已经拔下的浅紫色电源插头，插头的金属插脚清楚可见，插头连接一小段松弛的天蓝色电线。团子耷拉着耳朵，嘴角轻轻向下，眼睛水汪汪，委屈但仍然温暖可爱。不要插座、不要闪电、不要危险感。
构图：单只猫和指定少量道具居中，完整收进画面，在四周保留约10%的透明安全边距，主体连同道具占画幅约75%，线条清楚，细节适合缩小到160像素高使用。背景必须是真实透明alpha，背景完全空白透明，无不透明底色、无棋盘格、无白色描边贴纸边、无厚投影、无光晕、无颗粒、无漂浮噪点、无水印。不添加任何未要求的物体或文字。
画面完全无文字。
```

### 12. poster-summer-drink

- 最终文件：`src/api/mock/assets/poster-summer-drink.webp`（800×800，91192 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mock/poster-summer-drink.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mock/poster-summer-drink.request.json` / `docs/spec/concepts/v2/generation/0c/mock/poster-summer-drink.result.json`。
- 导出参数：`{"quality":82,"method":6,"resample":"LANCZOS","mode":"RGB"}`。

```text
Use case: ads-marketing
Asset type: finished Chinese commercial poster, square 1024×1024.
Reference image 1 is ONLY a visual reference for the polished lemon drink thumbnail on the project board; create the full standalone poster, no application UI.
Primary request: a refined summer new-product lemon drink advertisement. A tall clear glass of iced sparkling lemon drink with vivid lemon slices and condensation, fresh leaves, a few sliced lemons in foreground; airy pale mint and sky-blue backdrop, sunshine, premium food photography with crisp editorial typography.
Text (verbatim, simplified Chinese): large headline「夏季新品」, smaller「清爽柠檬饮」「限时上市」. Main headline occupies upper left and remains legible at thumbnail size; the glass on right. Attractive professional commercial hierarchy, careful spacing, natural lighting, clean bright high-end finish. All lettering and layout generated in the image. No watermark, no QR code, no browser, no frame, no UI.
```

### 13. brand-logo-upgrade

- 最终文件：`src/api/mock/assets/brand-logo-upgrade.webp`（800×800，23392 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mock/brand-logo-upgrade.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mock/brand-logo-upgrade.request.json` / `docs/spec/concepts/v2/generation/0c/mock/brand-logo-upgrade.result.json`。
- 导出参数：`{"quality":82,"method":6,"resample":"LANCZOS","mode":"RGB"}`。

```text
Use case: logo-brand
Asset type: finished brand identity proposal presentation board, square 1024×1024.
Reference image 1 is ONLY visual reference for the dark-blue brand upgrade thumbnail on the project board. Generate the full standalone commercial design, no application UI.
Primary request: premium corporate brand-mark upgrade proposal board on deep navy blue, a simple original elegant white geometric leaf-like monogram centered slightly left, flowing restrained blue and violet curved panels with subtle dimensional lighting. Confident minimal mark, beautiful precise typography, substantial negative space, credible Chinese brand studio presentation.
Text (verbatim, simplified Chinese): headline「品牌标志升级」, subheading「视觉识别 · 全新焕新」. Text large and clearly legible, white and pale blue. Keep elegant and concise, not busy. All lettering and final layout generated in the image. No existing famous logo, no watermark, no QR code, no app UI, no mockup monitor.
```

### 14. tea-gift-box

- 最终文件：`src/api/mock/assets/tea-gift-box.webp`（800×800，52950 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mock/tea-gift-box.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mock/tea-gift-box.request.json` / `docs/spec/concepts/v2/generation/0c/mock/tea-gift-box.result.json`。
- 导出参数：`{"quality":82,"method":6,"resample":"LANCZOS","mode":"RGB"}`。

```text
Use case: product-mockup
Asset type: premium tea packaging design presentation, square 1024×1024.
Reference image 1 is ONLY reference for the sophisticated green tea gift box thumbnails on the project board; create a full standalone packaging presentation, no application UI.
Primary request: a beautiful Chinese green-tea gift box packaging design. Cream textured-paper rectangular rigid gift box with refined sage-green botanical tea-leaf illustrations, tasteful deep green side panel, delicate gold accents, resting in an airy pale sage studio with a ceramic tea cup and a couple of fresh tea leaves. Hero box large, three-quarter angle showing front and side, photorealistic printed packaging, natural soft daylight, premium restrained composition.
Text (verbatim, simplified Chinese): box front title「茗香」, small subtitle「绿茶礼盒」. These are the only text. Ensure characters 茗 and 香 correct and prominent. All typography and layout generated in image. No watermark, no QR code, no app UI, no unrelated props.
```

### 15. double11-flowers

- 最终文件：`src/api/mock/assets/double11-flowers.webp`（800×800，55390 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mock/double11-flowers.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mock/double11-flowers.request.json` / `docs/spec/concepts/v2/generation/0c/mock/double11-flowers.result.json`。
- 导出参数：`{"quality":82,"method":6,"resample":"LANCZOS","mode":"RGB"}`。

```text
Use case: ads-marketing
Asset type: finished Chinese florist ecommerce product campaign image, square 1024×1024.
Reference image 1 is ONLY reference for the pink tulip promotional thumbnail on the project board; generate the full standalone campaign artwork, no application UI.
Primary request: refined Double Eleven flower gift promotion. A lush bouquet of elegant fresh pink tulips wrapped in pale rose paper with a satin ribbon, placed right of center against a soft warm pink studio backdrop with subtle flower-petal accents. Tender yet commercial, credible florist product photography, high-quality soft light and sophisticated editorial type.
Text (verbatim, simplified Chinese): headline「双十一」 and「花礼专场」, smaller「精选花束 · 限时优赠」. Large dark rose-red headline upper left, immaculate spacing, bouquet and text fully visible, lovely balanced composition. All lettering and layout generated by image model. No watermark, no QR code, no app UI, no clutter.
```

### 16. cafe-menu

- 最终文件：`src/api/mock/assets/cafe-menu.webp`（800×800，92888 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mock/cafe-menu.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mock/cafe-menu.request.json` / `docs/spec/concepts/v2/generation/0c/mock/cafe-menu.result.json`。
- 导出参数：`{"quality":82,"method":6,"resample":"LANCZOS","mode":"RGB"}`。

```text
Use case: ads-marketing
Asset type: finished Chinese cafe printed menu design, square 1024×1024.
Reference image 1 is ONLY a commercial finish reference from the project board. Generate the full standalone menu design, no application UI.
Primary request: warm brown artisan coffee shop menu design. Cream paper menu sheet fills most of frame, deep coffee brown refined serif-like Chinese headings, orderly left-aligned menu rows and prices, small tasteful line drawings of coffee utensils and a cup of latte in lower right, tactile paper, warm natural shadows. Sophisticated local cafe identity, beautifully spaced grid and readable hierarchy.
Text (verbatim, simplified Chinese): title「咖啡菜单」. Menu rows「美式咖啡 18」「拿铁咖啡 26」「卡布奇诺 26」「摩卡咖啡 28」. Small bottom text「现磨咖啡 · 慢享时光」. Use only these short texts, correctly rendered and aligned, no tiny filler. All text and layout generated in image. No watermark, no QR code, no app UI.
```

### 17. store-opening

- 最终文件：`src/api/mock/assets/store-opening.webp`（800×800，60636 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mock/store-opening.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mock/store-opening.request.json` / `docs/spec/concepts/v2/generation/0c/mock/store-opening.result.json`。
- 导出参数：`{"quality":82,"method":6,"resample":"LANCZOS","mode":"RGB"}`。

```text
Use case: ads-marketing
Asset type: finished Chinese coffee shop opening poster, square 1024×1024.
Reference image 1 is ONLY reference for the coffee-store opening thumbnail on the project board. Generate full standalone commercial poster, no application UI.
Primary request: a refined cafe grand opening poster, warm espresso-brown tones and cream highlights. A photorealistic white ceramic latte cup and saucer in foreground right, beautiful heart latte art, scattered coffee beans on warm wood, softly blurred cozy cafe background, faint green leaves at edge. Inviting premium local cafe advertising.
Text (verbatim, simplified Chinese): very large main headline「开业」, secondary「新品咖啡」, small「全场 8 折」. Elegant cream typography clearly readable on dark brown upper-left area, generous spacing, strong visual hierarchy. All text and final layout generated in image. No watermark, no QR code, no app UI, no extra text.
```

### 18. member-card

- 最终文件：`src/api/mock/assets/member-card.webp`（800×800，38080 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mock/member-card.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mock/member-card.request.json` / `docs/spec/concepts/v2/generation/0c/mock/member-card.result.json`。
- 导出参数：`{"quality":82,"method":6,"resample":"LANCZOS","mode":"RGB"}`。

```text
Use case: product-mockup
Asset type: premium bookstore membership card design presentation, square 1024×1024.
Reference image 1 is ONLY reference for the pastel bookstore membership-card thumbnail on the project board; create full standalone commercial design presentation, no application UI.
Primary request: two beautifully designed pale lavender bookstore membership cards, one front and one back, casually offset on a light lilac studio surface. Main card large in foreground, rounded corners, high-quality matte paper with a subtle fine botanical sprig and understated open-book line motif, delicate silver foil detail, soft dimensional shadows. Refined warm literary aesthetic, clean tasteful commercial print presentation.
Text (verbatim, simplified Chinese): main card「拾光书店」「会员卡」, small「阅读 · 生活 · 灵感」. All words crisp, correct and elegant. Other card may use only a small open-book icon, no filler text, no barcode, no QR code. All lettering and layout generated by image model. No watermark, no app UI.
```

### 19. product-detail-sofa

- 最终文件：`src/api/mock/assets/product-detail-sofa.webp`（800×800，103568 字节）。
- 原图：`docs/spec/concepts/v2/generation/0c/mock/product-detail-sofa.png`（1254×1254，PNG）。
- 请求参数与结果：`docs/spec/concepts/v2/generation/0c/mock/product-detail-sofa.request.json` / `docs/spec/concepts/v2/generation/0c/mock/product-detail-sofa.result.json`。
- 导出参数：`{"quality":82,"method":6,"resample":"LANCZOS","mode":"RGB"}`。

```text
Use case: ads-marketing
Asset type: finished Chinese home furnishings ecommerce detail-page hero panel, square 1024×1024.
Reference image 1 is ONLY reference for the light sofa interior thumbnail on the project board; create full standalone product detail design, no application UI.
Primary request: premium light-colored sofa product detail hero. A beautiful ivory modular sofa with soft cushions, staged in a sunlit minimal warm-white living room, beige rug, natural oak side table, one leafy plant, gauzy curtains, realistic fabric texture. Sophisticated photorealistic interior photography, soft architectural shadows, quietly luxurious and breathable. Product sofa occupies middle and lower two-thirds; tasteful clean headline area at top left.
Text (verbatim, simplified Chinese): headline「森临家居」, subtitle「舒适生活 由此开始」. Keep words correct and readable, restrained charcoal-gray typography, ample whitespace. All lettering and final layout generated in image. No watermark, no QR code, no app UI, no product catalog grid.
```
