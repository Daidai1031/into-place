# PLAN — 72 小时执行清单

原则:**先验证,再建造;先影片,后界面**。每阶段末尾有"割线"——时间不够时,线下全部放弃。

---

## Phase 0 · 验证门(H0–H4)⚠️ 未通过前不写任何应用代码

- [x] 在 fal 上核实 spec/04 全部候选端点是否存在 + 当日价格,写入 `lib/models.ts` 草稿
- [ ] Roosevelt Island 种子档案 v0:12–20 张公共领域图(NYPL Digital Collections / Library of Congress / Wikimedia:天花医院、Octagon、监狱、灯塔、各时期地图、Nellie Bly 报纸版面、石材纹理),含来源与 license → `data/places/roosevelt-island.json`
- [ ] 手工拼一张测试 collage(Figma,20 分钟):大前景毛边纸片 + 中景档案建筑抠像 + 远景历史地图,层间留缝 + 纸张投影
- [ ] **实验 A(首尾帧 vs 纯 prompt)**:同一 collage,Kling FLF 与 Kling I2V 各 1 次,5s/720p
- [ ] **实验 B(弱运动 vs 强运动)**:检查人物/建筑是否漂移、纸边是否扭曲、视差是否成立
- [ ] **HyperFrames spike(≤2 小时)**:3 层 PNG + CSS 3D 横移渲染 5s MP4;失败 → Puppeteer 截帧 + FFmpeg;再失败 → 全 fal 方案
- [ ] 结论记录到 `data/day0-findings.md`

**门槛:** 至少一个 fal 模型能保住档案内容并产生空间运动,且确定性路径可用。

## Phase 0.5 · 上岛实拍(H4–H8,可与 Phase 1 并行,强烈建议)

- [ ] 缆车上岛:拍 Renwick 废墟、灯塔、缆车、防波堤石块、回望曼哈顿视角(横构图 16:9,给 Anagnorisis 与 Katharsis 用)
- [ ] 实录环境声:缆车电机、河水与风、废墟混响、远处车流
- [ ] 这些是 demo 里"个人素材成为地方档案"的第一手证据

## Phase 1 · Pipeline 骨架,无 UI(H4–H16)

- [ ] Next.js 初始化 + 目录约定 + `data/` JSON 读写层(原子写回)
- [ ] `lib/prompt-compiler.ts`:shot JSON → 正/负 prompt(含固定保护块)
- [ ] `lib/fal.ts` + `/api/shot/generate` + `/api/shot/status`:queue 提交与轮询,成本记录
- [ ] HyperFrames 场景模板:`spatial` → MP4;同场景截帧 → start/end frame
- [ ] 预处理脚本:抠图(rembg / fal 端点)+ 毛边 + 阴影 → `assets/cutouts/`
- [ ] 无 UI 跑通 **scene_03 时间走廊(确定性)** 与 **scene_04 Push Through(fal)**
- ——割线——
- [ ] depth guide 灰度图输出

## Phase 2 · 五个镜头的成片(H16–H36)🎬 最高优先级

- [ ] 五个场景的 collage/spatial 定义完成(手工 + 脚本,不等 UI)
- [ ] S1 Stasis(确定性 dolly)· S3 Pathos 时间走廊(确定性横移)· S5 Katharsis(确定性拉远)
- [ ] S2 石块堆叠(Kling FLF,≤3 attempts)
- [ ] S4 hero shot(先 Kling 测通,最后 Veo 出正片:1880s 医院门洞 → 实拍废墟)
- [ ] 旁白五段(TTS 或自录)+ 实录/补齐环境声 + FFmpeg 混音
- [ ] `/api/assemble` → `final/final.mp4` v1
- ——割线——
- [ ] 时间紧则 S1 并入 S2,成片降为 4 镜头

## Phase 3 · 界面(H36–H56)

- [ ] Page 0 Atlas:风格化 SVG 地图 + 3 标记(RI 点亮;沙溪、Camino 半透明 "Be the first to contribute")
- [ ] Page 1 Research:卡片策展 + 上传(用途选择 + 署名入档)+ Wikimedia 按钮
- [ ] Page 2 Story:主人公候选 + 分镜编辑 + Place DNA 只读面板
- [ ] Page 3 Direct:单镜头生成/重生成 + 引擎徽章 + 状态轮询
- [ ] Page 4 Film:播放 + Journey Book(来源 + 社区署名 + 生成标注)
- ——割线——
- [ ] Place DNA 实时提取(否则预生成写死在种子包)
- [ ] Wikimedia 检索(否则按钮标 experimental 并禁用)

## Phase 4 · Demo 与提交(H56–H72)

- [ ] 全流程彩排 2 次,修复或绕开翻车点
- [ ] 录 3 分钟 demo(脚本见下)
- [ ] Repo 清理:README、截图、架构图、`.env.example`、无密钥痕迹
- [ ] Project Description 对齐评审四项;提交视频 + repo + 描述
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

## 预算纪律

测试 5s/720p;每镜头 ≤3 次;Veo 仅 S4 正片;单次 >$2 先确认;成本写入 shot JSON。Preview.io 不进 pipeline($50 credits 可忽略;它是竞争参照而非构件)。

## 风险登记

| 风险 | 触发信号 | 应对 |
|---|---|---|
| fal 模型融化 collage | 实验 A/B 全失败 | 提高确定性镜头占比;转场退化为确定性 push + 溶解 |
| HyperFrames 不可用 | spike 失败 | Puppeteer 截帧 + FFmpeg |
| 上岛没时间 | H8 未成行 | Wikimedia 上找 CC 授权的现代 RI 照片替代,demo 弱化"实拍"叙述 |
| Wikimedia 结果差 | 检索无可用图 | 全走种子包,按钮标 experimental |
| 时间塌方 | H48 成片未完成 | 冻结界面开发,全力保 Phase 2 |
