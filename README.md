# Into Place

> **Step inside the layered stories of a place.**
> The place determines the film. The user directs the journey.

Into Place 是一个地方记忆的 AI 共创平台:在风格化地图上走进一个地点,系统检索**有来源的真实档案**(历史照片、地图、材料、符号),用户上传自己的照片成为该地方公共档案的一部分,策展、选主人公、修改分镜,系统将真实素材拼成多层 collage keyframes,再通过 **确定性 2.5D 视差渲染 + fal 视频模型受控转场** 的混合引擎,输出一部具有拼贴定格质感、可穿行的地方历史短片。

**赛道:** fal × Sequoia 72-Hour Video Hackathon — Developer Track
**首个案例:** Roosevelt Island(Blackwell's → Welfare → Roosevelt;备选:沙溪古镇)
**开发者:** 单人 + AI coding agents (Claude Code / Codex / Gemini)

---

## 1. 核心问题

现有 AI 视频工具把每个地方都生成得一样:虚构建筑、通用复古滤镜、无来源的"历史"。Into Place 的回答:

- **真实性优先** — 素材来自公共领域档案与社区贡献,每张图保留来源、年代、版权状态;
- **共创档案** — 用户上传的照片经同意进入该地方的公共档案并署名;地图上未点亮的地方等待被贡献;
- **人机共创** — 研究、策展、主人公、分镜每一步都有确认与否决权,支持单镜头局部重生成;
- **受控生成** — 生成式模型只出现在物理上不可能的瞬间(穿越、材料聚合);视差镜头由确定性渲染完成。素材预处理中的 fal 只返回主体蒙版,原始 RGB 不交给模型重绘,蒙版只作用于 alpha。

## 2. 混合渲染引擎(技术核心)

```text
镜头类型                     引擎                        档案保真度
─────────────────────────────────────────────────────────────
Parallax Walk / Dolly /     HyperFrames 确定性渲染        100%(像素级)
Archive Hold / Crane Out    (分层 PNG + CSS 3D 摄影机)
─────────────────────────────────────────────────────────────
Push Through / Material     fal 首尾帧模型                受 preservation
Transformation              (Veo 3.1 FLF / Kling FLF)    constraints 约束
─────────────────────────────────────────────────────────────
```

两种引擎共用同一份场景定义:HyperFrames 直接渲染视差;把场景拍平截帧即成为 fal 转场的 start/end frame,镜头间无缝衔接。Shot Router 按 `shot_type` 分流(spec/04)。

## 3. Pipeline

```text
Atlas 地图选择地点(seeded / 待共创)
    ↓
Research(种子档案 + Wikimedia 实时检索 + 用户贡献)
    ↓  用户策展:删除 / 收藏 / 锁定;上传照片可署名进入地方档案
Place DNA 提取(颜色 / 材料 / 符号,只读展示)
    ↓
Narrative Agent:3 个主人公候选 + 地方连接理由 → 用户选择
    ↓
Storyboard:5 个分镜(亚里士多德五段结构)→ 用户改旁白 / 换图
    ↓
预处理:来源审核、语义裁剪、调色、蒙版、剪刀/手撕边 → 分层 PNG → Collage 场景定义
    ↓
Shot Router:确定性渲染 或 fal 生成(queue 模式)
    ↓  用户逐镜头审核,可局部重生成
Assembly:拼接 + 实录环境声 + 旁白 → Final Film + Journey Book
```

### 素材预处理 v2

- `data/preprocess/roosevelt-island.json` 以声明式 recipe 记录每张素材是什么、保留/排除什么、裁剪框、输出角色和审核状态;`asset_013` 是待人工选页的 PDF,当前明确跳过。
- 历史素材默认中性黑白,现代照片保留原色;纸卡默认稳定 seed 的手撕边,透明主体默认硬剪边,地图无边缘。未来 UI 可全局选择 `source | mono | sepia` 与 `scissor | torn`,并对单张素材覆盖。
- fal SAM 只生成蒙版(`apply_mask:false`);调色、裁剪、alpha 合成、边缘、白边和阴影全部在本地确定性完成。蒙版失败时按 fal → 本地 rembg/silueta → 裁剪纸卡回退,坏蒙版不得静默发布。
- 预处理禁止放大。低分辨率素材只写质量警告并限制场景 scale,不调用超分模型。
- 输出名用角色后缀明确语义:`*_card.png`(矩形纸卡)、`*_cutout.png`(透明主体)、`*_bg.png`(背景)。缓存由 source/recipe/tool/mask hash 共同判定;每个输出保存像素来源、操作、fal request/cost 与人工审核状态。
- 旧文件中“有些带 `_card`、有些不带”的差异来自 v1 的 `paper/auto` 两条硬编码分支,不是素材类别本身。v2 已删除这些无角色后缀的兼容文件;今后后缀就是可依赖的角色契约。
- contact sheet 人工审核是发布门。`review.visual: rejected` 的主体 recipe 保留 mask/provenance 供追溯,但 `publish:false`、不会进入 manifest 或场景;本轮 001/002/012/015/018 回退到已审核 card,014/017 保留透明 cutout。

## 4. 成片结构(Roosevelt Island,~31s,5 镜头)

| # | 幕 | 内容 | 引擎 |
|---|---|------|------|
| 1 | Stasis | East River 上安静的农场小岛 | HyperFrames |
| 2 | Peripeteia | 囚犯开采的石块定格堆叠成收容所高墙 | fal FLF |
| 3 | Pathos | 收容的世纪:疯人院、监狱、天花医院组成时间走廊 | HyperFrames |
| 4 | Anagnorisis | 穿过 1880s 档案照片门洞 → 用户实拍的 Renwick 废墟 | Veo 3.1 FLF (hero) |
| 5 | Katharsis | 拉远回到档案墙:被保存下来的是什么? | HyperFrames |

主人公:一块片麻岩——囚犯开采的石头砌成了关押他们自己的墙。完整大纲见 spec/06。

## 5. MVP 范围

**做:** Atlas 地图落地页 + 4 个工作页 · 种子档案 + Wikimedia 检索 + 社区贡献机制 · 5 镜头成片 · 单镜头局部重生成 · 来源追溯 Journey Book

**不做:** 3D 编辑器 / XYZ 拖拽 / Three.js · 时间线编辑器 · 游戏化积分 · 版本分支 · Mapbox · 本地部署视频模型 · 自动版权判定 · 多项目并行 · Preview.io 集成(无开发者 API;作为通用 AI 分镜工作台是我们的竞争参照,见 spec/00)

## 6. 技术栈

Next.js (App Router) · Vercel · fal API (server-side, queue mode) · HyperFrames (确定性渲染 + 合成) · FFmpeg (回退与混音) · JSON 文件存储

## 7. 文档索引

- `spec/` — 实现权威:数据模型、页面、API、路由、素材音频、案例(00–06)
- `CLAUDE.md` — AI coding agent 工程约定与花费纪律
- `PLAN.md` — 72 小时 checklist、验证门与回退路径
