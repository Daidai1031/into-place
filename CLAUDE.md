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
2. **单次调用预估成本 > $2 必须先询问开发者**,不得自行执行。
3. 开发与测试期参数上限:**5 秒、720p、16:9**。只有被明确标注 hero shot 的镜头允许提高。
4. 每个镜头最多 3 次生成尝试(`generation.attempts`),失败后停下来建议修改 collage 或 prompt,而不是继续重 roll。
5. Veo 只用于 hero shot(scene_04 push through);日常测试用 Kling/Wan/Vidu 等更便宜的候选。
6. 每次生成的 request_id、模型、参数、成本写入 shot JSON,保持可追溯。

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

- HyperFrames 渲染不可用/太慢 → 用 Puppeteer 截帧序列 + FFmpeg 合成同一 HTML 场景(场景定义格式不变);
- 抠图端点不理想 → rembg 本地跑;毛边用 canvas 蒙版近似;
- Wikimedia 检索质量差 → 只用预策展包,检索按钮保留但标注 experimental;
- fal 转场模型全部保不住档案内容 → 该转场退化为确定性 push(HyperFrames 放大穿过 + 交叉溶解),demo 叙事改为"我们宁可不用生成也不伪造历史"。

## 协作分工提示

开发者同时可用 Codex 与 Gemini。默认分工:你(Claude Code)负责应用代码与 fal MCP 操作;素材批量预处理脚本、旁白文案初稿等可并行外包给其他 agent,产出统一进入 SPEC §5 目录约定。
