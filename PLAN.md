# PLAN — 功能清单（v4，frame-to-video 主路径）

原则：状态必须一目了然；先保证随时有一部可播放的 demo，再推进真实付费生成。当前唯一视频主路径是 **approved storyboard frame → fal I2V → FFmpeg assembly**。

---

## 素材处理管线

目标：有来源的档案 → 通过审核的 card / cutout / background 图层。

- [x] 声明式 recipe 批量处理 JPG / TIFF
- [x] 历史素材默认 `tone:mono`，现代照片保留 `source`，`sepia` 备用
- [x] fal SAM 3 / 本地 rembg 只生成 alpha；RGB 始终来自本地原图
- [x] source review、visual review、QA 与 provenance 落盘
- [x] 19 个已发布图层可用于 Storyboard
- [ ] `asset_013` PDF 人工选页后再进入预处理——不阻塞 demo

## App 工作流

- [x] Atlas：Roosevelt Island 种子地点 + Shaxi / Camino 待共创入口
- [x] Archive：时间轴、素材策展、tone / edge 调整、用户上传与模拟审核
- [x] Story：3 个故事方向、5–8 个 beat、行内编辑、重写、插入与删除
- [x] Storyboard：每 beat 可选 generated frame 或 manual collage
- [x] Generated frame：参考档案、模型选择、文字编辑、拖入素材、provenance
- [x] Manual collage：真实 cutout 布局、画笔、层级与 undo
- [x] Film / Journey Book：预渲染样片、来源、许可、贡献者与生成行为清单
- [x] Library：保存、like、favorite、remove，localStorage 持久化
- [ ] Place DNA：可选增强项，`/api/dna` 当前保留 stub

## Frame-to-video 主路径

- [x] `lib/prompt-compiler.ts`：从 place / beat / references / motion 编译结构化 prompt
- [x] `lib/models.ts`：只保留当前 T2I / image-edit / I2V 模型注册表
- [x] 删除旧的分层视差视频框架与 headless-browser 截帧依赖
- [ ] Manual collage 导出 1280×720 PNG：优先浏览器 Canvas，必要时服务端 Sharp
- [ ] `/api/shot/generate`：接收审核后的 frame，queue submit I2V 任务
- [ ] `/api/shot/status`：轮询任务状态并保存 request ID、成本与输出 URL
- [ ] 每个镜头最多 3 次生成；之后必须修改 frame 或 prompt
- [ ] 逐镜审核：身份、建筑、印刷文字、拼贴布局与新增物体检查
- [ ] 将通过审核的镜头写入 project state

## 合成与声音

- [ ] FFmpeg 拼接所有通过审核的镜头
- [ ] page turn / wipe / match cut / crossfade 在后期完成
- [ ] 加入环境声
- [ ] 可选旁白（TTS 或自录）
- [ ] 可选音乐，并与环境声 / 旁白做响度平衡
- [ ] 输出最终 MP4，替换 `public/films/roosevelt-island.mp4`

## Demo 与提交

- [ ] 全流程彩排 2 次，确认无 fal 时仍可播放预渲染片
- [ ] 录制 3 分钟 demo
- [ ] Repo 清理：截图、架构图、`.env.local.example`、无密钥痕迹
- [ ] 最后 6 小时冻结新功能，只修阻塞 demo 的问题

### Demo 视频脚本（3:00）

| 时间 | 内容 | 对应评分 |
|---|---|---|
| 0:00–0:15 | 钩子：AI 视频抹平了地方，真实档案与社区记忆需要另一种方法 | Creativity |
| 0:15–1:15 | Atlas → Archive 策展 / 上传 → 选择故事方向 → 修改 beat | User Value |
| 1:15–2:00 | 生成或手工制作分镜帧 → 拖入档案素材 → 只重生成一个镜头 | Technical |
| 2:00–2:35 | 播放约 31 秒成片 | Demo |
| 2:35–3:00 | Journey Book：来源、许可、社区署名与生成记录 | Trust |

## 预算纪律

- 每次付费调用前复核 fal schema 与当日价格。
- 单次预估成本超过 $5、hero 模型或累计成本异常时先确认。
- 每个镜头最多 3 次尝试；request ID、模型、参数、成本和输出必须写入项目状态。
- 生成视频失败时播放预渲染 demo，不伪装为实时生成结果。

## 风险登记

| 风险 | 触发信号 | 应对 |
|---|---|---|
| I2V 改写主体或建筑 | 人脸、文字、结构漂移 | 停止重 roll，简化 frame / prompt 或更换模型 |
| Manual collage 无法稳定导出 | CORS、字体或尺寸差异 | 服务端用 Sharp 合成审核后的本地图层 |
| fal queue 超时 | Film 页长时间 pending | 保存 job ID，允许刷新后继续轮询；demo 播预渲染片 |
| 合成失败 | FFmpeg 参数或输入格式不一致 | 统一 16:9、帧率、编码与音频采样率后重试 |
| 时间不足 | I2V / assembly 尚未接通 | 冻结增强项，保证 Storyboard + 预渲染片 + Journey Book 可演示 |
