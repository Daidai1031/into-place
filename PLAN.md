# PLAN — 功能清单（v3，无强制顺序）

原则:**任务并行推进,谁先卡谁先切**。不设固定开发顺序——下面按功能模块分组,每组内部按"最省事先做哪个"排列,但组之间可以随时跳跃、并行处理。核心是**状态一目了然**:每条任务只关心"功能做没做",做完就打勾。

> 唯一硬性优先级:**手里随时要有一部能放的片子**。素材处理 + 确定性渲染是地基,其余都是加分项,时间塌方时先保这两块。

---

## 素材处理管线

目标:`assets/archive/` 18 项 → 可用图层。

- [x] `scripts/batch-cutout.mjs` 批量处理 JPG/TIFF,16 个图层已出(15 张撕纸卡 + asset_002 建筑抠像)
- [x] 统一底色:黑白档案 `tone:mono`,现代彩色照片保留彩色,`tone:sepia` 备用已实现
- [x] `mode:auto` 抠形跑通(rembg 云端,npm `@rmbg/model-silueta`);照片/半调印刷可用,线刻版画不可用(改纸卡)
- [x] 处理记录写回 `data/places/roosevelt-island.json` 每个 asset 的 `cutouts` 字段,溯源链完整
- [ ] asset_013(PDF)人工给页码后单页截取——不阻塞其他任务
- 现状:22 个图层就位(14 纸卡 + 1 地图 + 7 抠形),够搭 5 个场景。

## 确定性成片(零 fal 调用)

目标:一部完整的 ~31s 成片 v0,不依赖任何生成模型。

- [ ] 手写 5 个 `data/scenes/*.json`(spec/01 格式,参照 test-collage.json)
  - S1 Stasis(dolly in)· S3 Pathos(横移)· S5 Katharsis(拉远)——确定性镜头
  - S2 石块堆叠、S4 Push Through——先做确定性退化版(HyperFrames 放大穿过 + 交叉溶解),fal 版是后续升级项
- [ ] 每个场景 `scene-to-hyperframes.mjs` → `hyperframes render` 出 MP4
- [ ] FFmpeg 拼接 5 段 + 交叉溶解 → `final/final.mp4` v0(先无声或临时 TTS)
- 完成标准:能从头放到尾的一部片子。**这是提交底线,其余任务做多少算多少。**

## App 骨架(Next.js)— 2026-07-19 全部完成

- [x] Next.js 15 + Tailwind v4 根目录初始化(手动 merge package.json,旧 node 脚本不受影响);`scripts/sync-public.mjs` 桥接 assets/final → public
- [x] `data/project.json` 读写层(`/api/project/save` 原子写回,localStorage 为用户态真值)
- [ ] `lib/prompt-compiler.ts`:shot JSON → 正/负 prompt(含固定保护块)——归"fal 生成升级"组,UI 不阻塞
- [x] Page 4 Film:Generate 进度演出 + 播放 + Journey Book(来源/license/署名/生成行为清单);本地模式真写 project.json + generated scenes
- [x] Page 1 Archive(超出最小版):时间轴档案 + 上传 + 模拟审核 + 选素材 + tone/edge 调参
- 完成标准已达成:`npm run dev` 全流程可走,`npm run build` 通过,client bundle 无 FAL 痕迹。

## fal 生成升级(S2 / S4)

**预算已放开(2026-07-18 决定):效果优先。**纪律:先查 schema 与当日价格;成本/request_id 全部记录;单次 >$10 或累计异常膨胀先问;每镜头 3 次尝试后停下分析,不继续重 roll。

- [ ] `lib/fal.ts` + `/api/shot/generate` + `/api/shot/status`(queue 模式)
- [ ] 实验 A/B:用确定性成片的真实首尾帧,Kling FLF vs I2V 各 1 次,检查档案内容/纸边是否保住;同时评估 fal_i2v 主体动作(如人物坐下)是否保住身份特征,不只是测转场
- [ ] 实验通过 → S2 换 Kling FLF;S4 先 Kling 测通,正片可上 Veo(hero shot)
- [ ] 新转场类型(翻页/擦除/匹配剪辑)先出确定性 HyperFrames 版本,fal FLF 版本视效果按需追加
- [ ] 实验失败 → S2/S4 保持确定性退化版,demo 叙事改为"我们宁可不用生成也不伪造历史"

## 界面补全 — 2026-07-19 全部完成(结构升级,见 spec/02)

- [x] Page 0 Atlas:拼贴 SVG 地图 + 3 标记(RI 点亮;shaxi/camino "Be the first to contribute")+ 新地点输入占位
- [x] Page 2 Story:LLM 3 个故事走向 + 5–8 beat(fal any-llm / claude-sonnet-4.5),行内编辑 / re-roll / 删(≥5)/ AI 插写(≤8)
- [x] Page 3 Storyboard(原 Direct 重做):逐 beat collage canvas(拖拽/旋转缩放/层级/画笔/undo)+ AI 初始排版(nano-banana 参考稿 → vision LLM 布局 JSON → 真实像素,fallback 确定性排版)+ beat 间转场备注(可 AI 建议)
- [x] Page 1 上传(用途选择 + 署名入档 + 模拟审核 pending→checking→APPROVED)
- [x] `/library` 影片库:like/favorite/remove,localStorage 持久
- [ ] Place DNA 面板:降级为可选项,不在主流程(/api/dna 留 stub)
- 部署注意:Vercel env 需 `FAL_KEY` + `PUPPETEER_SKIP_DOWNLOAD=1`;线上 Generate 播预渲染片(`public/films/roosevelt-island.mp4` 已提交,占位幻灯版,渲染线出真片后替换 final/roosevelt-island.mp4 并重 sync)。

## 声音与个人素材(后置项)

- [ ] 旁白五段(TTS 或自录)+ 环境声 + FFmpeg 混音 → final.mp4 v1
- [ ] 上岛实拍 / 用户个人照片入档流程(demo 里"个人素材成为地方档案"的证据;去不了则用 Wikimedia CC 现代照片替代,弱化"实拍"叙述)

## Demo 与提交

- [ ] 全流程彩排 2 次,修复或绕开翻车点
- [ ] 录 3 分钟 demo(脚本见下;若 fal 升级没做,1:25–2:00 段改讲"确定性保真"技术点)
- [ ] Repo 清理:README、截图、架构图、`.env.local.example` 空模板、无密钥痕迹
- [ ] 留 4 小时缓冲;**最后 6 小时不引入新功能**

---

## Demo 视频脚本(3:00)

| 时间 | 内容 | 对应评分 |
|---|---|---|
| 0:00–0:15 | 钩子:AI 视频抹平了地方;真实档案与社区记忆需要另一种方法 | Creativity |
| 0:15–1:25 | 流程:Atlas 地图点亮 RI → 上传自己拍的废墟照片(署名入档)→ 策展删图 → Place DNA → 选"一块片麻岩" → 改旁白 → **仅重生成 Scene 2** | User Value |
| 1:25–2:00 | 引擎盖:shot JSON → prompt 编译;Router 分流确定性/生成;"视差镜头中档案像素零改动" | Technical (35%) |
| 2:00–2:35 | 成片完整播放(~31s) | Demo |
| 2:35–3:00 | Journey Book(含社区署名)+ "The place determines the film. The user directs the journey." | 收尾 |

## 预算纪律(2026-07-18 放宽)

效果优先:模型与参数按最好效果选,不强制先用便宜候选;单次 >$10 或累计预算异常时先确认;每镜头 3 次尝试后停下分析;成本与 request_id 写入 shot JSON(溯源不放松)。fal 调用只发生在"fal 生成升级"这一组,其余任务都是零成本的。

## 风险登记

| 风险 | 触发信号 | 应对 |
|---|---|---|
| fal 模型融化 collage | 实验 A/B 失败 | 关闭 fal 升级,全片确定性;叙事转"宁可不用生成" |
| HyperFrames 渲染某场景翻车 | render 报错/画面错乱 | `scripts/render-scene.mjs`(Puppeteer)截帧 + FFmpeg,场景 JSON 不变 |
| 抠图质量差 | 毛边/残留明显 | rembg 本地跑 + canvas 蒙版近似;实在不行该图层改整片纸片化 |
| 时间塌方 | 确定性成片 v0 未在中点完成 | 冻结其余所有组,全力保成片 v0 |
