# Into Place

> **Step inside the layered stories of a place.**
>
> The place determines the film. The user directs the journey.

Into Place 是一个以真实地方档案为起点的 AI 共创影像平台。用户从地图进入一个地点，策展有来源的历史素材，也可以贡献自己的照片；随后选择故事方向、修改叙事节拍、导演每一张分镜，并将它们发展为一部具有手工拼贴质感的创意地方短片。

**赛道：** fal × Sequoia 72-Hour Video Hackathon — Developer Track

**首个案例：** Roosevelt Island（Blackwell's → Welfare → Roosevelt）

**开发者：** 单人开发 + AI coding agents（Claude Code / Codex）

---

## 为什么做 Into Place

通用 AI 视频工具很容易把不同地方生成成相似的画面：虚构建筑、统一的复古滤镜，以及无法追溯的“历史感”。Into Place 采用四条不同的原则：

- **真实档案优先：** 历史照片、地图与文献必须保留来源、年代和许可信息。
- **地方共同记忆：** 用户可以上传个人照片，并选择是否署名贡献给该地点的公共档案。
- **人机共同导演：** 用户控制素材、故事方向、每个 beat、分镜画面和转场，而不是只输入一次 prompt。
- **生成内容可辨认：** AI 分镜始终标记为生成内容，不与原始档案混淆；最终 Journey Book 记录所用素材与生成行为。

## 当前状态

| 模块 | 状态 | 当前实现 |
|---|---|---|
| Atlas | ✅ 已完成 | 拼贴地图、Roosevelt Island 种子地点、Shaxi / Camino 待共创入口 |
| Archive | ✅ 已完成 | 20 条档案记录、19 个已发布图层、素材筛选、tone / edge 调整、用户上传与模拟审核 |
| Story | ✅ 已完成 | 基于所选档案生成 3 个故事方向，并生成、编辑、重写或插入 5–8 个叙事 beat |
| Storyboard | ✅ 已完成 | 每个 beat 可选择 AI-generated frame 或 manual collage；支持参考素材、文字修改、拖入素材与转场备注 |
| 逐镜视频生成 | ✅ 本地已接通 | Web 端逐镜提交 fal queue、轮询状态并在每个镜头完成后立即预览；支持 Kling / Happy Horse / Veo 3.1 |
| Film / Journey Book | ✅ 本地已接通 | 按顺序生成镜头、显示实际模型 / prompt / 估算成本、调用 FFmpeg 合成、保存影片并列出来源与许可 |
| 声音 | 🚧 开发中 | 当前 I2V 明确关闭模型音频，最终影片为静音；环境声、旁白和音乐尚未接入 |
| 实时档案检索 | ⏳ 待实现 | 当前使用 Roosevelt Island 预策展包；Wikimedia 实时检索 API 仍为 stub |

## End-to-end workflow

最短版本：**档案素材 → 用户策展 → LLM 写故事 → 图像模型做分镜 → 用户确认 → I2V 模型逐镜动画 → FFmpeg 合成 → Film + Journey Book**。系统不会让一个模型直接生成整部影片；每一步的结构化输出都是下一步的输入，并在关键节点等待用户选择或确认。

```text
Place + archive metadata
  → [用户] must use / maybe / reject + 上传素材
  → [Claude Sonnet 4.5 via fal any-llm] 3 个 directions
  → [用户] 选择 direction
  → [Claude Sonnet 4.5 via fal any-llm] 5–8 个 beats
  → [用户] 编辑 / reroll / insert beat
  → [图像模型] 每个 beat 的 16:9 frame，或 [手工] real-PNG collage
  → [用户] 编辑 frame + 确认转场
  → [Kling / Happy Horse / Veo 3.1] 每个已确认 frame → 一个 I2V clip
  → [FFmpeg，无模型] clips + transitions → final/<slug>.mp4
  → Final Film + Journey Book
```

### 每一步使用什么模型，input / output 是什么

下表以当前代码为准。`endpoint` 是 fal API 路径；“模型”是 endpoint 内实际选择的模型。所有 fal 调用只发生在 server route 或本地脚本中，`FAL_KEY` 不进入浏览器。

| # | 阶段 | 模型 / endpoint | 主要 input | 主要 output | 下一步如何使用 |
|---|---|---|---|---|---|
| 0 | 档案预处理（离线） | **SAM 3** · `fal-ai/sam-3/image`；失败时本地 `rembg:silueta`；裁剪与合成用 Sharp | 原始档案图像、recipe 中的主体 prompt、`apply_mask:false`、mask QA 阈值 | 主体 alpha mask、box / score；最终本地生成 `*_card.png` / `*_cutout.png` / `*_bg.png`，另写 provenance JSON | 通过人工 visual review 的 PNG 才进入地点 manifest 和 Archive 素材架 |
| 1 | 素材策展 | **无模型** | place JSON、档案元数据、用户上传；用户给出 `must use / maybe / reject` | 被选中的 `AssetBrief[]`：`id/title/era/type/description/contributor` | 作为叙事 LLM 的事实边界，也作为后续图像模型的 reference set |
| 2a | 生成故事方向 | **Claude Sonnet 4.5** · `fal-ai/any-llm` + `model=anthropic/claude-sonnet-4.5` | `PlaceBrief` + 用户策展后的 `AssetBrief[]` | 严格 JSON：3 个 `{id,title,premise}` + `requestId` | 用户选择其中一个 direction |
| 2b | 生成故事 beats | 同上 | `PlaceBrief` + `AssetBrief[]` + 已选 `{title,premise}` | 严格 JSON：5–8 个 `{id,act,text}` + `requestId` | 每个 beat 对应一张分镜和最终一个视频镜头 |
| 2c | 重写 / 插入 beat | 同上 | 地点、全部资产、当前 beats、`targetId`、`reroll` 或 `insert_after` | 单个 `{act,text}` + `requestId` | 替换目标 beat 或插在其后；用户仍可手工修改 |
| 3a | AI-generated 分镜 | 默认 **nano-banana 2 / Gemini 3.1 Flash Image** · `fal-ai/nano-banana-2/edit`；可选 FLUX.2 Pro、Seedream 4、Imagen 4 | 编译后的 frame prompt（地点 + premise + beat + 风格约束）+ 最多 7 张 source image 组成的 reference contact sheet；同一 source asset 最多用于 2 个场景；固定 16:9、1 张图 | `{imageUrl,model,prompt,requestId,costUsd,source:"generated"}` | 用户可重生成、自然语言编辑、拖入一份新档案；确认后的 `imageUrl` 成为 I2V 首帧 |
| 3b | Manual collage 自动布局 | **nano-banana edit** · `fal-ai/nano-banana/edit` 先生成临时构图参考；再用 **Claude Sonnet 4.5 Vision** · `fal-ai/any-llm/vision` | beat 文本、带编号的 cutout contact sheet、资产 id / role / aspect ratio；Vision 同时看 contact sheet 和临时构图 | `{layout:[{assetId,x,y,scale,rotation,z}],referenceUrl,requestIds,source}` | Canvas 按 JSON 排列**真实审核 PNG**；临时 AI 构图只作参考，不进入成片 |
| 3c | 转场建议 | **Claude Sonnet 4.5** · `fal-ai/any-llm` | 相邻的 `fromBeat`、`toBeat` | `{type,note}`，type 为 `page_turn/wipe/match_cut/push_dissolve` | 用户可修改；合成时映射为 FFmpeg xfade |
| 4 | 逐镜 image-to-video | 默认 **Kling v3 Turbo Standard** · `fal-ai/kling-video/v3/turbo/standard/image-to-video`；可选 Alibaba Happy Horse、Veo 3.1 | 已确认的 generated `frameUrl` + 编译后的 motion prompt + duration；Kling / Veo 强制 `generate_audio:false` | queue submit 返回 `requestId`；轮询完成后得到 `videoUrl` | 浏览器逐镜顺序生成并立即预览；所有 clip 完成后进入合成 |
| 5 | 最终合成 | **无生成模型，FFmpeg** | 按 beat 顺序的 `{videoUrl,transitionType}[]` | 统一为 1280×720 / 30fps、统一调色、0.7s xfade、片尾 fade；输出 `final/<slug>.mp4` 和 `/films/<slug>.mp4` | Film 页面播放；Journey Book 展示故事、来源和生成记录 |

> 当前真实 I2V Web 流程只处理 `source:"generated"` 的分镜。Manual collage 可以用于分镜与项目保存，但尚未在 Film 页面自动栅格化为可提交给 I2V 的首帧。最终合成当前没有音轨。

### 模型路由与选择规则

#### 叙事与转场

Story direction、beats、单 beat 重写 / 插入和转场建议都通过 `fal-ai/any-llm` 调用 `anthropic/claude-sonnet-4.5`。输入不是整份原始文件，而是地点摘要与用户已选档案的结构化 metadata；输出被要求为严格 JSON，并由服务端解析后才写入项目状态。

#### 分镜图像模型

| UI key | fal endpoint | Reference image | 支持编辑 | 用途 / 路由规则 |
|---|---|---:|---:|---|
| `nano-banana-2`（默认） | `fal-ai/nano-banana-2/edit` | ✅ | ✅ | 初次分镜、自然语言改图、拖入素材都可用 |
| `flux-2-pro` | `fal-ai/flux-2-pro` | ✅ | ❌ | 可生成 1280×720 分镜；进入编辑模式时自动切回 nano-banana 2 |
| `seedream-4` | `fal-ai/bytedance/seedream/v4/text-to-image` | ❌ | ❌ | prompt-only 生成；不会收到 reference contact sheet |
| `imagen-4` | `fal-ai/imagen4/preview` | ❌ | ❌ | prompt-only 生成；不会收到 reference contact sheet |

`generate` 模式把 reference cutouts 合成一张 contact sheet 后上传；`edit_prompt` 输入当前 frame + 用户指令；`edit_add_asset` 输入当前 frame + 新 cutout + drop position。三种模式都返回一张 16:9 frame。没有 `FAL_KEY`、运行在 Vercel 或模型失败时，route 返回明确写有 `AI-GENERATED FRAME — simulated` 的 SVG placeholder，不冒充真实生成结果。

#### I2V 视频模型

| UI key | fal endpoint | 可选时长 | 当前规则 |
|---|---|---|---|
| `kling-v3-turbo-std`（默认） | `fal-ai/kling-video/v3/turbo/standard/image-to-video` | 5s / 10s | 默认平衡方案；输入字段为 `image_url`，关闭模型音频 |
| `happy-horse` | `alibaba/happy-horse/image-to-video` | Web UI 3–8s；route 支持 3–15s | 目前固定 720p；输入字段为 `image_url` |
| `veo3.1-hero` | `fal-ai/veo3.1/image-to-video` | 4s / 6s / 8s | hero-only；需要显式成本确认，关闭模型音频 |

每个 I2V 请求只生成**一个 beat 对应的一个 clip**。`/api/shot/generate` 负责编译 motion prompt、估价和 queue submit；`/api/shot/status` 负责轮询并返回 `videoUrl`。这使失败或不满意时可以只重做一个镜头，而不推翻整部影片。

### 关键数据对象如何向下传递

```text
AssetBrief[]
  { id, title, era, type, description?, contributor? }
       ↓ narrative LLM
StoryDirection
  { id, title, premise }
       ↓ narrative LLM
StoryBeat[]
  { id, act, text }
       ↓ image model + user review
GeneratedFrame
  { imageUrl, model, prompt, requestId, costUsd, source }
       ↓ I2V queue
Shot
  { beatId, frameUrl, motionPrompt, model, requestId, videoUrl }
       ↓ FFmpeg
Film
  { filmUrl, clips }
```

项目交互状态以浏览器 `localStorage` 为主；本地环境还会镜像到 `data/project.json`。`/api/generate/start` 会额外生成 `data/scenes/generated/<slug>/film-manifest.json`，记录每个 beat 的 frame、模型、motion prompt 和转场，供脚本式渲染复用。

核心实现入口：Story 使用 `app/api/story/generate` 与 `app/api/story/reroll`；分镜使用 `app/api/storyboard/frame` 与 `app/api/storyboard/layout`；I2V 使用 `app/api/shot/generate` 与 `app/api/shot/status`；最终合成使用 `app/api/assemble`。模型注册表位于 `lib/models.ts`，fal client 位于 `lib/fal-server.ts`，所有生成 prompt 集中在 `lib/llm.ts` 和 `lib/prompt-compiler.ts`。

### Prompt 编译与档案保护

`lib/llm.ts` 负责编译叙事 prompt，`lib/prompt-compiler.ts` 统一编译 frame、edit 和 motion prompt。I2V prompt 将运动限制为一个主要摄影机动作和一个主体 / 环境动作，并附加保护块：

```text
no morphing, no new objects, no face changes, no costume changes,
no architecture changes, preserve printed text, preserve collage layout
```

SAM 3 只决定 alpha mask（`apply_mask:false`）；裁剪、调色、白边、阴影和 alpha 合成都在本地由 Sharp 完成。Generated frame 与 I2V clip 始终标记为 AI-generated，Manual collage 的最终 canvas 则只使用审核过的真实 PNG。

### 真实运行与 fallback 分支

| 环境 | Story | Frame | I2V | Assembly |
|---|---|---|---|---|
| 本地 + `FAL_KEY` + FFmpeg | 真实 LLM | 真实图像模型 | 真实 queue submit + polling | 写入 `final/` 和 `public/films/` |
| 本地但无 `FAL_KEY` | 不能发起新的 LLM 生成；可继续使用已保存 / seed story | 有标识的 placeholder；manual collage 可用 | 不提交任务 | 播放已有的预渲染影片（如存在） |
| Vercel | 配置 `FAL_KEY` 时可调用 LLM | 始终走有标识的 placeholder / manual collage | 不提交任务 | 播放预渲染 demo；不写文件 |

实时 Wikimedia 检索（`/api/research`）和 Place DNA（`/api/dna`）当前仍是明确返回 501 的 stub，不在上述生产 workflow 中。

## 素材预处理 v2

Roosevelt Island 的预处理由 `data/preprocess/roosevelt-island.json` 中的声明式 recipe 驱动：

- 历史素材默认使用中性黑白，现代照片保留原色；纸卡使用稳定的撕纸边，透明主体使用剪刀边。
- fal SAM 3 只生成主体蒙版（`apply_mask: false`）；裁剪、调色、alpha 合成、白边与阴影都在本地确定性完成，原始 RGB 不交给模型重绘。
- 处理过程禁止放大原图；低分辨率素材只记录质量警告并限制使用尺寸。
- 输出采用明确的角色后缀：`*_card.png`、`*_cutout.png`、`*_bg.png`。
- source review 与 visual review 分开记录；未通过视觉审核的输出不会进入 manifest 或场景。
- `asset_013` 是等待人工选页的 PDF，当前明确跳过；`asset_020` 是只用于历史语境的参考视频，不进入影片素材选择。

## Roosevelt Island 故事研究

当前案例已经发展出两条主要叙事方向，完整五镜结构、旁白与历史框架见 [`spec/06-place-case.md`](spec/06-place-case.md)。

| 方向 | 主角 / 视觉线索 | 核心问题 |
|---|---|---|
| **The Island New York Used Twice** | 一艘由纽约规划图折成的纸船 | 城市如何决定隐藏什么，又选择展示什么？ |
| **The Women Who Crossed the Water** | 一根成为 Nellie Bly 钢笔与连续墨线的鹅毛 | 谁拥有给女性贴上“危险”标签的权力，而声音如何越过围墙？ |

两条方向都采用五段结构（Stasis → Peripeteia → Pathos → Anagnorisis → Katharsis），但产品中的 Narrative Agent 不锁死案例脚本：它会依据用户实际选择的档案提出 3 个方向和 5–8 个可编辑 beat。

## 技术栈

- Next.js 15 App Router、React 19、TypeScript、Tailwind CSS 4
- fal：LLM、vision、图像生成 / 编辑、SAM 3 与 image-to-video 的统一生成层
- Sharp：本地裁剪、调色、alpha、纸张边缘处理，以及 manual collage 静态首帧合成
- FFmpeg：Web 本地流程中的视频镜头归一化、统一调色、转场拼接与片尾淡出；音频尚未接入
- localStorage：浏览器端项目状态；JSON 文件用于本地 I2V / 合成流程镜像

## 本地运行

### 环境要求

- Node.js 20+
- npm
- 可选：fal API key（没有 key 也可以走模拟帧与 manual collage）
- 最终影片合成需要 FFmpeg / ffprobe
- 仅在 SAM mask 不可用、预处理需要本地抠图 fallback 时需要 Python rembg

### 启动应用

```bash
npm install
```

如需真实 AI 调用，在根目录创建 `.env.local`：

```bash
FAL_KEY=your_fal_key
```

然后启动开发服务器：

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### 常用命令

| 命令 | 用途 |
|---|---|
| `npm run dev` | 同步公开素材并启动 Next.js 开发服务器 |
| `npm run build` | 同步公开素材并构建生产版本 |
| `npm run preprocess` | 按 recipe 批量预处理档案素材 |
| `npm run preprocess:review` | 生成预处理 contact sheet 供人工审核 |
| `npm run test:preprocess` | 运行预处理测试 |
| `npm run experiment -- <args>` | 运行 fal 视频模型实验 |

预处理与 I2V 实验脚本的完整参数见 [`scripts/README.md`](scripts/README.md)。

## 项目结构

```text
app/                    Next.js 页面与 server routes
components/             Atlas / Archive / Story / Storyboard / Film UI
lib/                    状态、模型配置、LLM 与 prompt 编译
data/places/            地点与档案元数据
data/preprocess/        recipe、蒙版、provenance 与审核记录
assets/archive/         原始档案文件
assets/cutouts/         审核后发布的 card / cutout / background 图层
scripts/                预处理、同步与 fal I2V 实验工具
spec/                   产品、数据、API、生成和案例规格
```

## 文档索引

- [`spec/00-index.md`](spec/00-index.md) — 实现规格入口
- [`spec/01-data-model.md`](spec/01-data-model.md) — Project / Place / Asset / Scene / Shot 数据结构
- [`spec/02-ui-pages.md`](spec/02-ui-pages.md) — 页面与交互规格
- [`spec/03-api.md`](spec/03-api.md) — Server routes 与安全约定
- [`spec/04-shot-router.md`](spec/04-shot-router.md) — 镜头路由与 prompt 编译规则
- [`spec/05-assets-audio-files.md`](spec/05-assets-audio-files.md) — 素材、音频与文件约定
- [`spec/06-place-case.md`](spec/06-place-case.md) — Roosevelt Island 案例研究
- [`PLAN.md`](PLAN.md) — 功能清单、验证门与风险登记
- [`CLAUDE.md`](CLAUDE.md) — AI coding agent 工程约定

---

**Into Place does not ask AI to invent a place. It asks people and archives how that place should be remembered.**
