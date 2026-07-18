# CLAUDE.md — Into Place 工程约定

你是本项目的主力开发 agent。开发者是单人,时间是 72 小时黑客松。**速度和可 demo 性优先于工程完美。**

## 项目一句话

真实地方档案 → 用户策展 → collage keyframes → 混合渲染(HyperFrames 确定性视差 + fal 首尾帧转场)→ 地方历史短片。详见 README.md;实现细节以 SPEC.md 为唯一权威。

## 技术栈与结构

- Next.js App Router + TypeScript + Tailwind,部署 Vercel。
- 无数据库:项目状态读写 `data/project.json`;素材与产物按 SPEC §5 目录约定落盘。
- 所有 fal 调用在 server route;`FAL_KEY` 只存在于 `.env.local` / Vercel env,**永不出现在客户端代码、日志、git 或聊天内容中**。`.env.local.example` 只能是空模板(`FAL_KEY=`),不是 `.gitignore` 排除的文件,真key写进去过一次(已修正,当时还没 commit),写 key 前确认目标文件名是 `.env.local` 不是 `.env.local.example`。
- 视频任务一律 queue 模式(submit + 轮询),不要同步等待。

## fal 使用纪律(严格遵守)

1. 调用任何模型前,先通过 fal MCP 查该端点的 **schema 和当日价格**;SPEC §4 中的模型名是候选,不是事实。
2. **预算已放宽(开发者 2026-07-18 决定,效果优先)**:正常调用不必逐次确认;**单次预估成本 > $10 或累计花费异常膨胀时先询问开发者**。
3. 参数按目标质量选(16:9 不变),不再强制 5s/720p 测试档;模型选择效果优先,便宜候选只作对照。
4. 每个镜头 3 次生成尝试(`generation.attempts`)后停下来分析、建议修改 collage 或 prompt,而不是继续重 roll——这是防翻车纪律,不是省钱纪律,保留。
5. 每次生成的 request_id、模型、参数、成本写入 shot JSON,保持可追溯。

## Prompt 规则

- 不手写自然语言 prompt:一律由 `lib/prompt-compiler.ts` 从结构化 shot JSON 编译。
- 负面/保护约束固定块(所有生成镜头必带):
  `no morphing, no new objects, no face changes, no costume changes, no architecture changes, preserve printed text, preserve collage layout` + `Diegetic sounds only. No music. No dialogue. No subtitles.`
- 一个镜头只描述**一个主要摄影机动作**;camera motion 与 object motion 分开描述,禁止 "everything moves dynamically" 式写法。

## 真实性红线(产品原则,同样是代码规则)

- 档案图片在确定性视差镜头中不得经过任何生成式处理;
- 生成产物永远不能被标记/展示为档案;UI 上生成镜头必须带标注;
- 每个 asset 的 source / license 字段是必填,不允许写入无来源素材。

## 范围控制

SPEC §7 列出的东西**不要做**,即使看起来"顺手"。发现需求超出 4 页界面 / 5 镜头 / 单项目范围时,先问开发者而不是扩建。UI 组件用最朴素的 Tailwind 实现,不引入组件库大依赖;好看服务于 demo 录屏即可。

## 回退路径(遇阻即切换,不要死磕)

- HyperFrames 已经装好并跑通(见下面「拼贴渲染管线」),是**当前主路径**,不是待验证的选项;渲染不可用/太慢时 → 用 `scripts/render-scene.mjs`(Puppeteer 截帧 + 同一份 `data/scenes/*.json`,场景定义格式不变),这条路径也已经验证可用,不是空谈的 plan B;
- 抠图端点不理想 → rembg 本地跑;毛边用 canvas 蒙版近似;
- Wikimedia 检索质量差 → 只用预策展包,检索按钮保留但标注 experimental;
- fal 转场模型全部保不住档案内容 → 该转场退化为确定性 push(HyperFrames 放大穿过 + 交叉溶解),demo 叙事改为"我们宁可不用生成也不伪造历史"。

## 已知素材获取限制(持续更新,完成一项任务后同步)

- **NYPL Digital Collections**:`digitalcollections.nypl.org` 有 Incapsula 机器人拦截,curl 直连会 403;需先用 WebFetch 读条目页拿到内部数字 image id,再用 `images.nypl.org/index.php?id=...&t=X` 下载。`t=w` 只是预览档(~760px 长边),**无需 API key 即可拿到大得多的档位**:立体照片/版画类条目有 JPEG 档位 `t=g`(约 6700–8900px 长边);其余条目最高到 `t=u`(TIFF 母版,约 2600–3300px 长边,需转码)。可用档位因条目类型而异,新条目建议按字母顺序试探 `t=` 值并核对实际像素尺寸(不能只看文件字节数)。详见 `data/day0-ri-archive-notes.md` 已知问题表。
- **Wikimedia Commons**:超大原始文件(尤其 HABS 的 `.tif`)会被限流,提示改用缩略图;`Special:FilePath` 重定向 + 指定宽度的 thumb URL 是稳定退路,3840px 长边级别的衍生图完全够用作 collage 图层。
- **扫描版 PDF 类档案素材**(如 asset_013 *Ten Days in a Mad-House*)不能直接当图片图层用,需要人工先给出目标页码,再做单页截取,流程见 `data/day0-ri-archive-notes.md`。
- **石材/片麻岩纹理特写**:NYPL/LOC/Wikimedia 三个来源均未检索到专门的采石场或墙面石材特写图,已确认为检索盲区,交由 Phase 0.5 上岛实拍补齐,不再继续检索。

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

## 协作分工提示

开发者同时可用 Codex 与 Gemini。默认分工:你(Claude Code)负责应用代码与 fal MCP 操作;素材批量预处理脚本、旁白文案初稿等可并行外包给其他 agent,产出统一进入 SPEC §5 目录约定。
