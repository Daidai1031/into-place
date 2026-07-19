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
| Film / Journey Book | 🟡 可演示 | 保存项目与分镜状态、展示生成进度、播放预渲染样片、列出来源与许可 |
| 逐镜视频生成 | 🚧 开发中 | I2V 模型配置与 prompt compiler 已加入；queue submit / polling 尚未接通 |
| 自动合成与声音 | 🚧 开发中 | FFmpeg 拼接、环境声、可选旁白和音乐尚未接入 Web 流程 |
| 实时档案检索 | ⏳ 待实现 | 当前使用 Roosevelt Island 预策展包；Wikimedia 实时检索 API 仍为 stub |

## 产品流程

```text
Atlas
选择已点亮的地点，或发现一个等待社区贡献的地点
    ↓
Archive
浏览有来源的种子档案 → 选择 must use / maybe / reject
上传个人照片 → 选择用途、署名与是否进入地方档案
    ↓
Story
AI 根据地点与所选素材提出 3 个故事方向
用户选择一个方向 → 生成 5–8 个 beat → 逐段编辑、重写或插入
    ↓
Storyboard
为每个 beat 生成 16:9 分镜帧，或切换到手工 collage 模式
选择参考档案 → 文字修改 / 拖入素材 → 编辑镜头间转场
    ↓
Video（开发中）
结构化 prompt → fal image-to-video → 逐镜审核与局部重生成
    ↓
Assembly（开发中）
镜头拼接 + 环境声 + 可选旁白 / 音乐
    ↓
Final Film + Journey Book
```

## 技术核心：用 fal 串联完整创作链

Into Place 不是在流程末尾调用一次视频模型，而是把 fal 作为贯穿素材处理、叙事、分镜和镜头生成的多模型创作层。每个阶段使用不同的 fal 能力，并把用户审核后的结构化结果传给下一步。

| 阶段 | fal 能力 | 在 Into Place 中的作用 | 状态 |
|---|---|---|---|
| Archive preprocessing | SAM 3 segmentation | 只生成主体 mask；原始档案 RGB 留在本地处理 | ✅ 已接通 |
| Story | `any-llm` | 根据地点与用户策展的档案提出 3 个故事方向，再生成 5–8 个可编辑 beat | ✅ 已接通 |
| Collage composition | `nano-banana/edit` + `any-llm/vision` | 生成构图参考，再由 vision LLM 转成真实 cutout 的布局 JSON | ✅ 已接通 |
| Generated storyboard | nano-banana 2 / FLUX.2 | 从 beat、film premise 与档案 references 生成 16:9 frame，并支持语言编辑与拖入素材 | ✅ 已接通 |
| Video shot | Kling / Happy Horse / Veo 候选 | 把用户审核后的 storyboard frame 作为首帧，生成逐镜 I2V 片段 | 🚧 Queue 接入中 |

### 1. fal 多模型路由，而不是单一黑盒

所有模型集中注册在 `lib/models.ts`，所有 fal 请求封装在 server-only 的 `lib/fal-server.ts`。Story、vision、image edit 与 I2V 共享地点、beat、reference asset IDs 和审核状态，避免每一步重新输入一段无法追踪的自由 prompt。

```text
Curated archive
  → fal LLM story directions
  → fal LLM story beats
  → fal image generation / editing
  → approved storyboard frame
  → fal image-to-video
  → reviewed shot
```

### 2. 用 fal 生成可能性，把导演权留给用户

- **Narrative control：** 用户从 fal 生成的 3 个方向中选择，也可以修改、重写、插入或删除 beat。
- **Frame control：** 每个 beat 可以重新生成分镜、选择 reference set、用自然语言编辑，或把档案 cutout 拖到指定位置。
- **Shot control：** I2V 只接收用户确认后的 frame；镜头生成后逐条审核，而不是一次生成整部影片。
- **Local regeneration：** 一个镜头失败时只修改该 frame 或 motion prompt，不推翻整条故事。

### 3. 结构化 prompt 与模型保护约束

`lib/llm.ts` 和 `lib/prompt-compiler.ts` 从地点、故事 premise、beat、参考素材、摄影机动作与主体动作编译 prompt。每个视频镜头最多包含一个主要摄影机动作和一个主体 / 环境动作，并自动加入保护块：

```text
no morphing, no new objects, no face changes, no costume changes,
no architecture changes, preserve printed text, preserve collage layout
```

这些约束让 fal 模型把生成重点放在运动与转场，而不是随意重写人物、建筑和档案文字。

### 4. fal 生成可追溯、可计费、可停止

每次生成都记录 `model`、编译后的 `prompt`、`requestId`、reference asset IDs、估算成本、编辑历史和尝试次数。视频任务采用 queue submit + polling；每个镜头最多尝试 3 次，之后必须修改 frame 或 prompt。模型 schema 与价格在付费调用前重新核实，hero 模型或单次预估超过 $5 时需要人工确认。

### 5. 为真实档案划定 fal 的使用边界

- SAM 3 只返回 alpha mask（`apply_mask:false`），不会重绘档案 RGB。
- Generated frame 和 I2V shot 始终标记为 AI-generated，绝不重新标记为 archive。
- Manual collage 直接排列审核后的真实 PNG；fal 只提供构图参考，最终 canvas 使用原始档案像素。
- Journey Book 同时展示档案来源、license、贡献者，以及 fal 在每个阶段做过什么。
- 没有 `FAL_KEY` 或调用失败时，系统返回明确标注的模拟 frame，并允许切换 manual collage；fallback 不会冒充真实生成。

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
- FFmpeg：视频镜头拼接、转场与混音（Web 自动化接入中）
- localStorage：浏览器端项目状态；JSON 文件用于本地 I2V / 合成流程镜像

## 本地运行

### 环境要求

- Node.js 20+
- npm
- 可选：fal API key（没有 key 也可以走模拟帧与 manual collage）
- 仅在运行最终合成 / 预处理脚本时需要：FFmpeg、Python rembg

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
