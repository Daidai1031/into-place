# 02 · 页面规格(2026-07-19 与实现同步:地图落地页 + 4 个工作页 + 影片库)

全英文界面。工作流:**Atlas → Archive → Story → Storyboard → Film → Library**,顶栏 `StepNav` 面包屑(Archive → Story → Storyboard → Film)。朴素 Tailwind v4,无组件库;拼贴美学 = 纸纹背景(inline SVG turbulence)+ 撕纸边(三套稳定 clip-path 变体)+ 胶带/印章/手写体点缀。用户态(选素材、调参、上传、story、frames、layouts、影片库)全部存 localStorage,详见 spec/03 环境分裂机制。

## Page 0 — Atlas(`/`)

风格化拼贴地图(inline SVG 撕纸大陆 + 海纹 + 虚线航线,非真实投影):

- 标记来自 `data/places/*.json` 的 `map_marker{x,y}`(归一化坐标绝对定位);
- `seeded` 地点(Roosevelt Island):红色菱形标记 + ping 动画,hover 出纸卡(名称/tagline/条目数),点击 → Archive;
- `empty` 地点(`shaxi.json`、`camino.json`):半透明虚线圆 "?",hover "Be the first to contribute";
- `NewPlaceInput`:输入新地点名 → "new places open soon" 提示(不实做);
- 底部平台陈述:人人可贡献,来源与署名永远保留。

## Page 1 — Archive(`/p/[slug]/archive`,原 Research 扩展)

**历史时间轴 + 共创素材库 + 上传 + 预处理调参**:

- 时间轴:分桶横向滚动(`lib/era.ts` 解析自由文本 era → 年代桶,不做按年比例刻度),手绘轨道线 + 年代刻度,素材卡挂在所属年代下;最右 "Today" 桶 = 用户上传 + `AudioSlotCard`(音频记忆,coming soon 占位);
- 素材卡:缩略图(cutout 的 `*_card.png`)/ 标题 / 年代 / 来源链接 / license / fact_level / contributor 徽章;PDF 条目(asset_013)显示文档占位 + "Open PDF source";
- `FoundCounter`:"Found: N archival photographs, M prints & maps, K community contributions";
- 上传(`UploadModal`):拖拽/点选图片(客户端压到 ≤1600px JPEG 存 localStorage)+ 标题/描述/年代/用途(texture / protagonist_ref / bridge / ending / inspiration)+ "share to public archive" 勾选;
- **模拟审核**(`ModerationFlow`):uploading → pending review → checking source & rights → APPROVED 印章动画;每步持久化,刷新不回退;通过后才可选用;
- 选素材:每卡 Must use · Maybe · Skip;`SelectionTray` 底栏实时计数,≥3 才放行 "Continue to Story";
- **预处理调参**(`PreprocessTuner`):每卡 "tune" → tone(source/mono/sepia,CSS 滤镜实时预览)+ edge(torn/scissor/none,clip-path/白边预览),recipe 默认值带 · 标记,可一键重置;真值映射 recipe `defaultTone/defaultEdge`,本地同时写 overrides(spec/03);预览是近似,真实像素只由本地确定性管线处理;
- "Search more"(Wikimedia)按钮保留,标 experimental,当前 stub。

## Page 2 — Story(`/p/[slug]/story`)

- 未策展 ≥3 素材时提示回 Archive;
- 第一步:`Draft story directions` → LLM 给 **3 个备选故事走向**(标题+一两句前提),或用户自写方向;
- 第二步:选定走向 → LLM 生成 **5–8 条 beat**(数量由剧情决定),每条 1–2 句 + 幕标签;
- Beat 卡:点击行内编辑 / `re-roll`(AI 重写该条)/ `delete`(≥5 才可删)/ beat 之间 "+ add a beat here"(AI 插写,≤8);
- "start over" 重来;全部就绪 → "Continue to Storyboard"。

## Page 3 — Storyboard(`/p/[slug]/direct` 原 Direct 重做为 `/p/[slug]/storyboard`)

**逐 beat 双路径分镜**:

- `BeatStrip`:横向 beat 缩略条(●=已有审核帧),beat 之间转场 chip(page_turn / wipe / match_cut / push_dissolve / custom + 备注,可 "Suggest with AI");
- 默认 `Generated frame`:从 beat、film premise 与选定 archive references 编译 prompt,生成 16:9 frame;支持模型选择、自然语言编辑、把 cutout 拖到指定位置继续编辑;所有结果标注 AI-generated 并记录 request ID / prompt / cost / references;
- 可切换 `Manual collage`:16:9 `CollageCanvas` 使用真实 cutout,支持拖拽、旋转、缩放、层级、画笔与 undo;进入 I2V 前导出为静态 PNG;
- 16:9 canvas(`CollageCanvas`):纯 pointer events + CSS transform,拖拽移动、单角柄旋转+缩放、层级前后移、移除;坐标归一化存 `{assetId,x,y,scale,rotation,z}`;
- `AssetShelf`:已策展素材点击上画布,每 beat 3–8 个(推荐 5);
- **AI 初始排版(manual collage)**:客户端拼 contact sheet → 图像模型出参考稿 → vision LLM 出布局 JSON → 真实 cutout 像素按 JSON 摆放;参考稿只折叠展示且带 "AI-generated reference — not archive, not the output" 标注;AI 不可用时规则化布局兜底,永不阻塞;
- **画笔**(`BrushOverlay`):顶层 canvas 手绘(5 色 + 粗细),笔迹序列化 PNG 持久化;undo 快照栈(布局+笔迹);
- 全部 beat 都有 generated frame 或 manual collage → "Continue to Film"。

## Page 4 — Film(`/p/[slug]/film`)

- 前置校验:story ≥5 beats 且每个 beat 都有审核后的 generated frame 或 manual collage,否则引导回对应页;
- `Generate the film` → 先 `/api/project/save` 镜像状态,再 `/api/generate/start`(写 `film-manifest.json` + 播预览);真实成片由本地 `scripts/render-film.mts` 消费 manifest,经 `/api/shot/*`(或直接 fal queue)出各镜头 I2V + FFmpeg xfade 合成 → `final/<slug>.mp4` → `scripts/sync-public.mjs`;付费运行需显式 `--yes`;
- 真实 i2v 运行时逐镜头实时视图:每个镜头显示状态(submitting/animating/ready)、该镜头实际编译出的 motion prompt、以及镜头一出片就内嵌预览(不等整批);模拟/demo 环境仍走线性 checklist;
- 合成把各镜头统一调色(muted blue-gray/sepia,提亮抬黑位)并片尾渐隐到黑,细节见 `spec/04-shot-router.md`「合成后期」;当前无音轨;
- 播放器 + 模式说明(local preview / simulation);`+ Save to library`;
- **Journey Book**:用到的档案来源(标题/年代/来源链接/license)+ 社区贡献署名 + "What the models did" 生成行为清单(生成物永不冒充档案——真实性红线)。

## Library(`/library`)

- localStorage 影片库:纸卡网格 + 胶带,内嵌播放;❤ like / ⭐ favorite / remove,全部持久化;空态引导回 Atlas。

## 通用

拼贴 UI 组件库在 `components/ui/`:`PaperCard`(seed 决定撕边变体)、`TapeStrip`、`Stamp`、`CollageButton`、`StepNav`、fact_level/license/contributor/era 徽章、`Modal`。字体:系统栈(Georgia 衬线 / Segoe Print 手写 / Courier New 打字机),避免 build 时拉外网字体。
