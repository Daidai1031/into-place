# PLAN — MVP 优先执行清单（v2）

原则改为:**确定性优先,线性推进,遇到问题当场调试**。素材已收齐(18 项入档),HyperFrames 渲染已跑通——不再设"验证门",验证并入开发:每一步的产出都是 MVP 的一部分。fal 生成镜头是**升级项**,不是阻塞项;任何时刻停下来,手里都有一部能放的片子。

> v1 计划(验证门模型)的遗留:手工拼 collage、实验 A/B 未做。它们没有被删除,而是并入下面的 Step 1 和 Step 4。
> 声音、用户个人照片/上岛实拍:按开发者决定**后置**,见 Step 6。

---

## Step 1 · 素材处理管线(当前卡点,最先做)💥

目标:`assets/archive/` 18 项 → 可用图层,全部用脚本批量完成,不再手工。

- [x] 用 `scripts/batch-cutout.mjs` 批量处理**已知可用格式**(JPG/TIFF;TIFF 自动转码验证通过):16 个图层已出——15 张撕纸卡(`mode:paper`,含 asset_001 立体照片裁单幅、asset_003 整张地图)+ asset_002 建筑抠像(tone 已事后统一)
- [x] **统一底色**:黑白档案全部 `tone:mono`(灰度 + 对比度归一,确定性处理,不碰生成红线),亮黄立体照片卡与中性灰版画已归一;现代彩色照片保留彩色;`tone:sepia`(统一暖调)已实现备用
- [x] **asset_013(PDF)明确跳过**,等人工给页码再单页截取,不阻塞任何后续步骤
- [x] 处理记录已写回 `data/places/roosevelt-island.json` 每个 asset 的 `cutouts` 字段(文件、mode、tone、crop),溯源链完整
- [ ] **待本机补跑**:7 个 `mode:auto` 抠形任务(asset_001/006/012/014/015 建筑 + asset_017/018 现代照片)——云端容器网络策略拦了 rembg 模型下载,本机跑一次 `node scripts/batch-cutout.mjs` 即可(幂等,只补缺的);或在环境设置放行 `github.com` 后云端重跑
- 完成标准:5 个场景需要的图层全部就位。现有 16 层已够搭全部 5 个场景的 v0(纸卡 + 地图 + asset_002 建筑层),抠形层到位后替换升级。

## Step 2 · 确定性 MVP 成片(最高优先级)🎬

目标:零 fal 调用,先出一部完整的 ~31s 成片 v0。

- [ ] 手写 5 个 `data/scenes/*.json`(spec/01 格式,参照已验证的 test-collage.json):
  - S1 Stasis(dolly in)· S3 Pathos 时间走廊(横移)· S5 Katharsis(拉远)——本来就是确定性镜头
  - S2 石块堆叠、S4 Push Through——**先做确定性退化版**(HyperFrames 放大穿过 + 交叉溶解,即 CLAUDE.md 回退路径),fal 版在 Step 4 再升级
- [ ] 每个场景 `scene-to-hyperframes.mjs` → `hyperframes render` 出 MP4;有问题当场调场景 JSON,不回头改管线
- [ ] FFmpeg 拼接 5 段 + 交叉溶解 → `final/final.mp4` **v0**(先无声或临时 TTS 旁白)
- ——割线——时间塌方时,v0 就是提交的成片,后面全部步骤只做加分项
- 完成标准:能从头放到尾的一部片子。**这是 MVP 雏形的核心,先于一切 UI 和 fal。**

## Step 3 · App 骨架(Next.js,无生成功能)

- [ ] Next.js 初始化 + Tailwind + 目录约定;`data/project.json` 读写层(原子写回)
- [ ] `lib/prompt-compiler.ts`:shot JSON → 正/负 prompt(含固定保护块)——纯函数,先写好并配一个快照测试,fal 接入前就能验证
- [ ] Page 4 Film 的最小版:播放 v0 成片 + Journey Book(来源/license/生成标注)——**先让 MVP 可 demo**
- [ ] Page 1 Research 的最小版:卡片列表展示 roosevelt-island.json(只读,上传后置)
- 完成标准:`npm run dev` 打开就能放片、能看档案来源。到这一步,**可提交的 MVP 已存在**。

## Step 4 · fal 升级(S2 / S4,含原实验 A/B)

**预算已放开(开发者 2026-07-18 决定):效果优先,不逐次省钱。**仍保留的纪律:先查 schema 与当日价格;成本/request_id 全部记录;单次 >$10 或累计异常膨胀时先说一声;每镜头 3 次尝试后停下来分析而不是继续重 roll。参数直接上目标质量,不再强制 5s/720p 测试档。

- [ ] `lib/fal.ts` + `/api/shot/generate` + `/api/shot/status`(queue 模式,request_id/成本写入 shot JSON)
- [ ] **实验 A/B 在此执行**:用 Step 2 产出的真实首尾帧,Kling FLF vs I2V 各 1 次,检查档案内容是否保住、纸边是否扭曲——这是 S2/S4 升级的前置判断,不是独立仪式
- [ ] 实验通过 → S2 换 Kling FLF;S4 先 Kling 测通,正片再上 Veo(hero shot 才允许提参数)
- [ ] 实验失败 → S2/S4 保持确定性退化版,demo 叙事改为"我们宁可不用生成也不伪造历史",**此步整体关闭**
- ——割线——只升级 S4 一个镜头也可接受

## Step 5 · 界面补全(Page 0/2/3)

- [ ] Page 0 Atlas:风格化 SVG 地图 + 3 标记(RI 点亮,其余 "Be the first to contribute")
- [ ] Page 3 Direct:单镜头生成/重生成 + 引擎徽章 + 状态轮询(依赖 Step 4;Step 4 关闭则本页只展示确定性渲染状态)
- [ ] Page 2 Story:分镜编辑 + Place DNA 只读面板(预生成写死在种子包)
- [ ] Page 1 补上传(用途选择 + 署名入档)
- ——割线——Page 2 与上传砍掉不影响 demo 主线

## Step 6 · 声音与个人素材(后置项,时间允许才做)

- [ ] 旁白五段(TTS 或自录)+ 环境声 + FFmpeg 混音 → final.mp4 v1
- [ ] 上岛实拍 / 用户个人照片入档流程(demo 里"个人素材成为地方档案"的证据;去不了则用 Wikimedia CC 现代照片替代,弱化"实拍"叙述)

## Step 7 · Demo 与提交

- [ ] 全流程彩排 2 次,修复或绕开翻车点
- [ ] 录 3 分钟 demo(脚本见下;若 Step 4 关闭,1:25–2:00 段改讲"确定性保真"技术点)
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

效果优先:模型与参数按最好效果选,不强制先用便宜候选;单次 >$10 或累计预算异常时先确认;每镜头 3 次尝试后停下分析;成本与 request_id 写入 shot JSON(溯源不放松)。fal 调用只发生在 Step 4,之前的一切都是零成本的。

## 风险登记

| 风险 | 触发信号 | 应对 |
|---|---|---|
| fal 模型融化 collage | Step 4 实验 A/B 失败 | 关闭 Step 4,全片确定性;叙事转"宁可不用生成" |
| HyperFrames 渲染某场景翻车 | render 报错/画面错乱 | `scripts/render-scene.mjs`(Puppeteer)截帧 + FFmpeg,场景 JSON 不变 |
| 抠图质量差 | 毛边/残留明显 | rembg 本地跑 + canvas 蒙版近似;实在不行该图层改整片纸片化 |
| 时间塌方 | 成片 v0 未在中点完成 | 冻结 Step 3 之后所有步骤,全力保 Step 2 |
