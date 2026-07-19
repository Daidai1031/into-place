# CLAUDE.md — Into Place 工程约定

你是本项目的主力开发 agent。开发者是单人,时间是 72 小时黑客松。**速度和可 demo 性优先于工程完美。**

## 项目一句话

真实地方档案 → 用户策展 → AI-generated / manual collage 分镜帧 → fal image-to-video → FFmpeg 合成 → 地方历史短片。详见 README.md;实现细节以 `spec/` 为唯一权威。

## 技术栈与结构

- Next.js App Router + TypeScript + Tailwind,部署 Vercel。
- 无数据库:项目状态读写 `data/project.json`;素材与产物按 SPEC §5 目录约定落盘。
- 所有 fal 调用在 server route;`FAL_KEY` 只存在于 `.env.local` / Vercel env,**永不出现在客户端代码、日志、git 或聊天内容中**。
- 视频任务一律 queue 模式(submit + 轮询),不要同步等待。

## fal 使用纪律(严格遵守)

1. 调用任何模型前,先通过 fal MCP 查该端点的 **schema 和当日价格**;SPEC §4 中的模型名是候选,不是事实。
2. **预算已放宽(开发者 2026-07-18 决定,效果优先)**:正常调用不必逐次确认;**单次预估成本 > $5 或累计花费异常膨胀时先询问开发者**。
3. 参数按目标质量选(16:9 不变),不再强制 5s/720p 测试档;模型选择效果优先,便宜候选只作对照。
4. 每个镜头 3 次生成尝试(`generation.attempts`)后停下来分析、建议修改 collage 或 prompt,而不是继续重 roll——这是防翻车纪律,不是省钱纪律,保留。
5. 每次生成的 request_id、模型、参数、成本写入 shot JSON,保持可追溯。

## Prompt 规则

- 不手写自然语言 prompt:一律由 `lib/prompt-compiler.ts` 从结构化 shot JSON 编译。
- 负面/保护约束固定块:
  `no face changes, preserve printed text` + `Diegetic sounds only. No music. No dialogue. No subtitles.`

## 真实性红线(产品原则,同样是代码规则)

- 生成产物永远不能被标记/展示为档案;UI 上生成镜头必须带标注;
- 每个 asset 的 source / license 字段是必填。

## 素材预处理 v2(严格遵守)

1. 预处理必须由声明式 recipe 驱动。先定位素材内容并写清保留/排除对象,再设置 EXIF 摆正后的归一化 crop;灰阶条、标尺、扫描底板等无关物不能进入成品。`asset_013` 是待人工选页的 PDF,继续跳过。
2. fal 只生成主体蒙版,请求必须显式 `apply_mask:false`;原始 RGB 不得交给模型重绘。调色、裁剪、alpha 合成、边缘、白边与阴影全部本地确定性完成。
3. 禁止超分和任何 resize 放大。001、008、012 等低分辨率素材只写质量警告并限制场景 scale。
4. tone 为 `source | mono | sepia`;edge 为 `scissor | torn | none`。历史素材默认 mono、现代照片 source;纸卡默认稳定 seed 的 torn、透明主体 scissor、背景 none。未来 UI 允许全局选择与单素材覆盖,recipe 默认值仍是回退真值。
5. 输出名必须带角色后缀:`*_card.png`、`*_cutout.png`、`*_bg.png`;场景与 manifest 只能引用规范名。
6. fal mask 最多两次提示/ROI 尝试。回退顺序固定为 SAM → 本地 silueta/rembg → 裁剪纸卡;坏 mask 不得静默发布。
7. 缓存同时校验 source hash、recipe hash、工具版本和 mask 配置。`--force` 只重做本地像素阶段;只有 `--refresh-mask` 可再次收费。provenance 必须记录像素来源、操作链、request_id、模型、参数、核价时间、成本、hash、警告与审核状态,永不记录密钥。
8. 所有结果先写 staging,通过 alpha/覆盖率/bbox/连通区域/尺寸/RGB 来源检查和 contact sheet 人工审核后再原子发布。
9. recipe 的来源审核与视觉审核必须分开记录。`review.visual: rejected` 必须同时设置 `publish:false` 和明确的 `fallbackRecipeId`;该输出不得进入 `assets/cutouts`、manifest 或场景。修改 review/publish 状态不得使已付费 mask 缓存失效。


## 已知素材获取限制(持续更新,完成一项任务后同步)

- **NYPL Digital Collections**:`digitalcollections.nypl.org` 有 Incapsula 机器人拦截,curl 直连会 403;需先用 WebFetch 读条目页拿到内部数字 image id,再用 `images.nypl.org/index.php?id=...&t=X` 下载。`t=w` 只是预览档(~760px 长边),**无需 API key 即可拿到大得多的档位**:立体照片/版画类条目有 JPEG 档位 `t=g`(约 6700–8900px 长边);其余条目最高到 `t=u`(TIFF 母版,约 2600–3300px 长边,需转码)。可用档位因条目类型而异,新条目建议按字母顺序试探 `t=` 值并核对实际像素尺寸(不能只看文件字节数)。详见 `data/day0-ri-archive-notes.md` 已知问题表。
- **Wikimedia Commons**:超大原始文件(尤其 HABS 的 `.tif`)会被限流,提示改用缩略图;`Special:FilePath` 重定向 + 指定宽度的 thumb URL 是稳定退路,3840px 长边级别的衍生图完全够用作 collage 图层。
- **扫描版 PDF 类档案素材**(如 asset_013 *Ten Days in a Mad-House*)不能直接当图片图层用,需要人工先给出目标页码,再做单页截取,流程见 `data/day0-ri-archive-notes.md`。
- **云端容器下载 rembg 模型**:网络策略只放行包管理源,GitHub release / Hugging Face / 第三方 CDN 的模型直链全部 403。可行解:npm `@rmbg/model-u2netp` 与 `@rmbg/model-silueta` 把 rembg 官方权重分块打进 npm 包,按序拼接后 md5 与 rembg 期望值一致,放进 `~/.u2net/` 即可离线用(`REMBG_MODEL=silueta`,拼接命令见 `scripts/README.md`)。抠形质量:照片/半调印刷可用,线刻版画不可用(只走纸卡)。

## Web UI(2026-07-19 已上线,严格遵守)

- 全英文界面;页面结构与组件约定以 spec/02 为准,API 以 spec/03 为准。工作流:Atlas `/` → Archive `/p/[slug]/archive` → Story → Storyboard → Film → `/library`。
- **环境分裂**:`lib/capabilities.ts`(`!process.env.VERCEL`)决定本地写文件/线上只读演示;**localStorage 是用户态唯一真值**,`data/project.json` 只是本地 I2V/合成流程的状态镜像。Vercel 只需配置 `FAL_KEY`。
- fal 封装只用 `lib/fal-server.ts`(`import "server-only"`)与 `lib/llm.ts`;route 文件不得泄露 key 或把付费生成放到客户端。已核价端点(2026-07-19):`fal-ai/any-llm` $0.001/req(premium 10x)、`fal-ai/any-llm/vision`(premium 3x)、`fal-ai/nano-banana/edit` $0.0398/图。
- AI 排版参考稿(nano-banana)只作参考:折叠展示 + "not archive, not the output" 标注;canvas/成片永远用未改动的 cutout 像素;AI 失败一律回退 `lib/layout-fallback.ts`,demo 不阻塞。
- **`npm run build` 会清掉 dev server 的 `.next`**——dev 跑着时别 build(会导致页面 chunk 404,踩过);typecheck 用 `npx tsc --noEmit`。
- `public/cutouts`、`public/films` 由 `scripts/sync-public.mjs` 生成,勿手改;demo 成片 `final/roosevelt-island.mp4` → sync → `public/films/`(此文件例外进 git,供 Vercel 播放;I2V + FFmpeg 出真片后替换并重 sync)。

## 分镜到视频管线

`scripts/cutout.mjs`(抠图/毛边/投影)→ Storyboard 生成帧或 manual collage → 审核后的 16:9 start frame →
`lib/prompt-compiler.ts` 编译运动 prompt → fal I2V queue → 逐镜审核 → FFmpeg 拼接/转场/混音。

- 2026-07-19 架构决定:移除旧的浏览器录制/分层视差 CLI 管线;不要重新引入 headless browser 或独立视频渲染框架。manual collage 静态导出优先使用浏览器 Canvas,服务端需要合成时使用现有 Sharp。
- generated frame 与 manual collage frame 都必须记录对应 beat、参考 asset IDs、prompt/编辑记录和生成 provenance;只有审核后的 frame 可以进入 I2V。
- manual collage 导出时只允许组合已审核的 `assets/cutouts/*.png` 和用户笔迹;生成后的平面帧不得再交给分割模型反向找层。
- sharp 用蒙版扣形状,必须用 `joinChannel(灰度蒙版)` 把蒙版的灰度值直接当 alpha 装上去;`composite({blend:"dest-in"})` 认的是输入图**自己的** alpha 通道,喂一张没有 alpha 的纯灰度蒙版进去会被当成"处处不透明",抠不出形状(踩过这个坑,输出是整块方形而不是蒙版形状)。
- 本机环境依赖:FFmpeg(winget `Gyan.FFmpeg`)和 rembg(`pip install rembg[cli] onnxruntime`,可执行文件在 `%APPDATA%\Roaming\Python\Python314\Scripts`)都已装好,可执行文件目录也已经永久加进 User PATH——新开的终端应该直接能用;如果是这次改动之前就开着的旧终端,PATH 变更对它不生效,新开一个就好。
- 转场备注支持 page_turn / wipe / match_cut / push_dissolve / custom;默认在 FFmpeg 后期实现,只有确有叙事价值时才调用生成式转场。细节见 `spec/04-shot-router.md`。
- **合成后期在 `lib/film-assemble.ts` 的 `xfadeConcat` 里做**(`/api/assemble` 与 `scripts/render-film.mts` 共用):拼接前给每个镜头套同一份 `GRADE`(muted blue-gray 阴影 + 暖 sepia 中间调,提亮抬黑位对抗 i2v 偏暗,`saturation 0.85`,护高光),让分别生成的镜头统一;片尾 `fadeOutDur`(默认 1.0s)渐隐到黑。`GRADE` 是单一可调常量,偏暗/偏灰在此微调。**目前无音轨**——line 67 的"混音"是规划目标,i2v `generate_audio:false` 且合成不 map 音频,旁白/环境音留待后续单独一轮。
- **Film 页实时透明**:真实 i2v 运行时 `components/film/FilmView.tsx` 按镜头逐个显示状态、该镜头实际编译出的 motion prompt、以及镜头一出片就内嵌预览(不等整批);模拟/demo 环境仍走旧的线性 checklist。
- **实现面(2026-07-19 pivot 落地)**:分镜帧 = `app/api/storyboard/frame`(generate/edit_add_asset/edit_prompt),T2I 见 `lib/models.ts` `T2I_MODELS`(`nano-banana-2` 默认 / `flux-2-pro`);镜头 = `app/api/shot/generate`+`app/api/shot/status`(queue),I2V 见 `I2V_MODELS`(`kling-v3-turbo-std` 默认 / `happy-horse` / `veo3.1-hero`,`generate_audio:false`);整片 = 本地 `scripts/render-film.mts` 读 `data/scenes/generated/<slug>/film-manifest.json`(由 `/api/generate/start` 写)→ 逐镜头 I2V → FFmpeg xfade → `final/<slug>.mp4`,**付费运行需 `--yes`,hero/超 $5 需 `--confirm`**,`placeholder` 帧跳过。
- **默认故事预设**:`data/presets/<slug>.json`(Roosevelt Island = **Direction Two「THE WOMEN WHO CROSSED THE WATER」** 五幕 + 每 beat references),`lib/presets.ts` 服务端加载,经 Story/Storyboard 页种子化;`/story` 读预设 JSON 而非 spec/06,新项目自动种子化,并有「load built-in story」按钮供已缓存旧故事的用户一键切换。
- **生成式主路径端点核实(2026-07-19,fal MCP 本会话未连,经 fal 页面/文档确认存在;价格随时变动,`verifyBeforeCall` 端点首次付费前仍需 MCP 复核)**:`fal-ai/nano-banana-2/edit`(Gemini 3.1 Flash Image,≤14 参考图)、`fal-ai/flux-2-pro`、`fal-ai/kling-video/v3/turbo/standard/image-to-video`($0.112/s)、`alibaba/happy-horse/image-to-video`($0.14/s@720p)、`fal-ai/veo3.1/image-to-video`($0.20/s@720p 无音频,hero)。已验证:5 张 Direction-One 分镜帧(nano-banana-2 + 参考 cutout + 风格锚链)风格统一、贴合叙事。


# Into Place UI Redesign Rules
- Preserve all routes, data flows, APIs, scripts, and generation workflows.
- Do not delete or rewrite functional components for visual reasons.
- Work only on the redesign branch and inspect before editing.
- State planned files, implement one phase, run build, then stop.
- Style: tactile archival collage, editorial, spatial, refined, readable.
- Use restrained colors, clear typography, purposeful texture, and selective motion.
- Avoid SaaS patterns, gradients, glassmorphism, pill UI, random scrapbook decoration, and tourism aesthetics.
- Keep changes responsive, accessible, easy to review, and easy to revert.