# CLAUDE.md — Into Place 工程约定

你是本项目的主力开发 agent。开发者是单人,时间是 72 小时黑客松。**速度和可 demo 性优先于工程完美。**

## 项目一句话

真实地方档案 → 用户策展 → collage keyframes → 混合渲染(HyperFrames 确定性视差 + fal 首尾帧转场)→ 地方历史短片。详见 README.md;实现细节以 SPEC.md 为唯一权威。

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
- 负面/保护约束固定块(所有生成镜头必带):
  `no morphing, no new objects, no face changes, no costume changes, no architecture changes, preserve printed text, preserve collage layout` + `Diegetic sounds only. No music. No dialogue. No subtitles.`
  这组约束防的是**身份/材质被改写**(换脸、换装、建筑变形、新增物体),**不禁止**姿态/位置类动作——两者不矛盾。
- 一个镜头最多**一个相机动作 + 一个主体/环境动作**(允许具体动作,如人物坐下、车辆移动),两者分句描述,不合并成 "everything moves dynamically" 式写法。

## 真实性红线(产品原则,同样是代码规则)


- 生成产物永远不能被标记/展示为档案;UI 上生成镜头必须带标注;
- 每个 asset 的 source / license 字段是必填,不允许写入无来源素材。

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


## 回退路径(遇阻即切换,不要死磕)

- HyperFrames 已经装好并跑通(见下面「拼贴渲染管线」),是**当前主路径**,不是待验证的选项;渲染不可用/太慢时 → 用 `scripts/render-scene.mjs`(Puppeteer 截帧 + 同一份 `data/scenes/*.json`,场景定义格式不变),这条路径也已经验证可用,不是空谈的 plan B;
- Wikimedia 检索质量差 → 只用预策展包,检索按钮保留但标注 experimental;
- fal 转场模型全部保不住档案内容 → 该转场退化为确定性 push(HyperFrames 放大穿过 + 交叉溶解),demo 叙事改为"我们宁可不用生成也不伪造历史"。

## 已知素材获取限制(持续更新,完成一项任务后同步)

- **NYPL Digital Collections**:`digitalcollections.nypl.org` 有 Incapsula 机器人拦截,curl 直连会 403;需先用 WebFetch 读条目页拿到内部数字 image id,再用 `images.nypl.org/index.php?id=...&t=X` 下载。`t=w` 只是预览档(~760px 长边),**无需 API key 即可拿到大得多的档位**:立体照片/版画类条目有 JPEG 档位 `t=g`(约 6700–8900px 长边);其余条目最高到 `t=u`(TIFF 母版,约 2600–3300px 长边,需转码)。可用档位因条目类型而异,新条目建议按字母顺序试探 `t=` 值并核对实际像素尺寸(不能只看文件字节数)。详见 `data/day0-ri-archive-notes.md` 已知问题表。
- **Wikimedia Commons**:超大原始文件(尤其 HABS 的 `.tif`)会被限流,提示改用缩略图;`Special:FilePath` 重定向 + 指定宽度的 thumb URL 是稳定退路,3840px 长边级别的衍生图完全够用作 collage 图层。
- **扫描版 PDF 类档案素材**(如 asset_013 *Ten Days in a Mad-House*)不能直接当图片图层用,需要人工先给出目标页码,再做单页截取,流程见 `data/day0-ri-archive-notes.md`。
- **石材/片麻岩纹理特写**:NYPL/LOC/Wikimedia 三个来源均未检索到专门的采石场或墙面石材特写图,已确认为检索盲区,交由 Phase 0.5 上岛实拍补齐,不再继续检索。
- **云端容器下载 rembg 模型**:网络策略只放行包管理源,GitHub release / Hugging Face / 第三方 CDN 的模型直链全部 403。可行解:npm `@rmbg/model-u2netp` 与 `@rmbg/model-silueta` 把 rembg 官方权重分块打进 npm 包,按序拼接后 md5 与 rembg 期望值一致,放进 `~/.u2net/` 即可离线用(`REMBG_MODEL=silueta`,拼接命令见 `scripts/README.md`)。抠形质量:照片/半调印刷可用,线刻版画不可用(只走纸卡)。

## Web UI(2026-07-19 已上线,严格遵守)

- 全英文界面;页面结构与组件约定以 spec/02 为准,API 以 spec/03 为准。工作流:Atlas `/` → Archive `/p/[slug]/archive` → Story → Storyboard → Film → `/library`。
- **环境分裂**:`lib/capabilities.ts`(`!process.env.VERCEL`)决定本地真跑/线上模拟;**localStorage 是用户态唯一真值**,`data/project.json` 只是本地渲染管线镜像。Vercel env 需 `FAL_KEY` + `PUPPETEER_SKIP_DOWNLOAD=1`。
- fal 封装只用 `lib/fal-server.ts`(`import "server-only"`)与 `lib/llm.ts`;route 文件永不 import puppeteer/sharp/hyperframes。已核价端点(2026-07-19):`fal-ai/any-llm` $0.001/req(premium 10x)、`fal-ai/any-llm/vision`(premium 3x)、`fal-ai/nano-banana/edit` $0.0398/图。
- AI 排版参考稿(nano-banana)只作参考:折叠展示 + "not archive, not the output" 标注;canvas/成片永远用未改动的 cutout 像素;AI 失败一律回退 `lib/layout-fallback.ts`,demo 不阻塞。
- **`npm run build` 会清掉 dev server 的 `.next`**——dev 跑着时别 build(会导致页面 chunk 404,踩过);typecheck 用 `npx tsc --noEmit`。
- `public/cutouts`、`public/films` 由 `scripts/sync-public.mjs` 生成,勿手改;demo 成片 `final/roosevelt-island.mp4` → sync → `public/films/`(此文件例外进 git,供 Vercel 播放;渲染线出真片后替换重 sync)。
- puppeteer 每次 launch 是全新 profile:测 localStorage 流程要么先注入种子状态,要么固定 userDataDir。

## 拼贴渲染管线

`scripts/cutout.mjs`(抠图/毛边/投影)→ 手写 `data/scenes/*.json`(spatial.planes + camera_path,spec/01 格式)→
`scripts/scene-to-hyperframes.mjs`(翻译成 HyperFrames composition)→ `hyperframes render`/`preview` 出片/live 预览。
`scripts/render-scene.mjs`(Puppeteer 直出静帧)是回退路径,已验证可用,不是纸面方案。全部用法见 `scripts/README.md`。

- **HyperFrames 是真实存在、已安装的工具**:npm 包名 `hyperframes`(HeyGen 出品,`heygen-com/hyperframes`),已装成 devDependency,命令走 `npx hyperframes <cmd>`。不要再当作"待评估的假设性方案"对待或去找别的同名东西。
- 分层文件(`assets/cutouts/*.png` + `data/scenes/*.json`)永远是场景的唯一源文件;渲染只能单向(层→拍平帧/MP4),渲染结果不得再喂回任何抠图/分割模型。
- HyperFrames composition 规则:计时元素要有 `class="clip"` + `data-start/data-duration/data-track-index`,同一 `data-track-index` 上时间段不能重叠;纯定位容器(比如我们的 `#world` 相机层)不要加这些属性,否则会被当成"两个重叠的 clip"而 lint 报错。相机动画直接用 GSAP 的 `x/y/z` 简写去 tween 一个 `transform-style:preserve-3d` 容器,不用手算每帧 transform 字符串。
- sharp 用蒙版扣形状,必须用 `joinChannel(灰度蒙版)` 把蒙版的灰度值直接当 alpha 装上去;`composite({blend:"dest-in"})` 认的是输入图**自己的** alpha 通道,喂一张没有 alpha 的纯灰度蒙版进去会被当成"处处不透明",抠不出形状(踩过这个坑,输出是整块方形而不是蒙版形状)。
- Puppeteer 里要用本地 `file://` 图片,页面必须用 `page.goto(fileURL)` 打开一个真正 file:// 起源的 HTML 文件;`page.setContent()` 生成的文档 origin 是 `about:blank`,Chromium 会拒绝其加载本地 `file://` 图片,截图全是"加载失败"占位图。
- 本机环境依赖:FFmpeg(winget `Gyan.FFmpeg`)和 rembg(`pip install rembg[cli] onnxruntime`,可执行文件在 `%APPDATA%\Roaming\Python\Python314\Scripts`)都已装好,可执行文件目录也已经永久加进 User PATH——新开的终端应该直接能用;如果是这次改动之前就开着的旧终端,PATH 变更对它不生效,新开一个就好。
- 转场形式已扩展(翻页 page_turn / 擦除 wipe / 匹配剪辑 match_cut,原有 push_dissolve 仍是默认),确定性 HyperFrames 实现优先,fal FLF 版本是可选升级,细节见 `spec/04-shot-router.md`。
