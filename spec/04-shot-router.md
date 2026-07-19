# 04 · Frame-to-video Router 与 Prompt 编译

## 主路径

每个 beat 先产生一张用户审核过的 16:9 frame，再生成视频：

```text
generated frame ─┐
                 ├→ approved start frame → prompt compiler → fal I2V queue → shot review
manual collage ──┘  （先导出 PNG）
```

不再维护独立的分层视频渲染器或 headless-browser 截帧回退。Manual collage 的档案像素保真发生在静态首帧导出阶段；视频输出必须明确标记为 AI-generated。

## Frame 路由

| frame source | 输入 | 进入 I2V 前的处理 |
|---|---|---|
| `generated` | fal-hosted `BeatFrame.imageUrl` | 校验 16:9、审核状态、references 与 provenance |
| `manual_collage` | `BeatLayout.items` + brush overlay | 浏览器 Canvas 导出 1280×720 PNG；遇到 CORS / 稳定性问题时用服务端 Sharp 合成 |
| `placeholder` | 带模拟标签的 SVG/data URL | 只允许走 demo preview，不得提交付费 I2V 或冒充正式镜头 |

## I2V 模型路由

候选模型只允许来自 `lib/models.ts`。端点与价格是易变信息，首次付费调用前必须重新核实 schema 与当日价格。

| 用途 | 默认候选 | 规则 |
|---|---|---|
| 普通镜头 | `kling-v3-turbo-std` | 平衡质量与成本，接收一张 start frame |
| 预算对照 | `happy-horse` | 只在 schema / 价格复核后使用 |
| Hero 镜头 | `veo3.1-hero` | 仅显式 hero 标记可选，调用前人工确认 |

所有任务使用 queue submit + polling；不得在 HTTP 请求中同步等待长视频生成。每镜头最多 3 次尝试，失败后必须修改 frame、motion 或 prompt。

实现：in-app 走 `/api/shot/generate`(submit)+ `/api/shot/status`(poll);整片合成走本地 `scripts/render-film.mts`(读 `data/scenes/generated/<slug>/film-manifest.json` → 逐镜头 I2V → FFmpeg xfade → `final/<slug>.mp4`),付费运行需 `--yes`,hero/超 $5 需 `--confirm`。`placeholder` 来源的帧会被跳过,不提交付费 I2V。

## Prompt 编译（`lib/prompt-compiler.ts`）

Prompt 从 place、film premise、beat、frame references 与 motion 结构编译，不在 route 或 UI 中拼接自由文本：

1. scene intent：当前 beat 中观众看到什么；
2. camera：最多一个主要摄影机动作；
3. subject / environment motion：最多一个主要动作，与 camera 分句描述；
4. style：`handmade archival collage, paper cutout, stop-motion feeling`；
5. preservation：`no morphing, no new objects, no face changes, no costume changes, no architecture changes, preserve printed text, preserve collage layout`；
6. audio：`Diegetic sounds only. No music. No dialogue. No subtitles.`。

保护约束防止身份、材质、建筑与文字被重写，但不禁止用户明确要求的姿态或位置动作。

## 转场

常规转场在镜头生成之后由 FFmpeg 完成：

| type | 后期实现 |
|---|---|
| `cut` | 直接切 |
| `crossfade` / `push_dissolve` | 视频交叉淡化 |
| `wipe` | FFmpeg wipe transition |
| `page_turn` | 优先用简化 wipe / overlay 模拟纸页翻动 |
| `match_cut` | Storyboard 阶段先对齐构图，后期直接切或短 crossfade |
| `custom` | 保存用户备注，合成前人工确认实现方式 |

生成式转场不是默认路径。只有普通后期无法表达必要叙事动作时，才单独评估 FLF 模型。

## 合成后期(FFmpeg,`lib/film-assemble.ts` 的 `xfadeConcat`)

拼接同时做统一后期,`/api/assemble` 与 `scripts/render-film.mts` 共用一份逻辑:

- **统一调色**:5 个分别生成的镜头在拼接前都套同一份 `GRADE`(共享调色,不是逐镜直方图匹配),让整片一致——muted blue-gray 阴影 + 暖 sepia 中间调,提亮抬黑位对抗 i2v 输出偏暗(`eq brightness` + `curves 0/0.05` 抬黑,`1/0.97` 护高光,`saturation 0.85` 去饱和)。是单一可调常量,偏暗/偏灰在此一处微调。
- **片尾渐隐**:拼好的时间轴末尾 `fadeOutDur`(默认 1.0s)渐隐到黑。
- 目前**无音轨**(i2v `generate_audio:false`,合成也不 map 音频);旁白/环境音留待后续单独一轮。

## 审核与追溯

每个 shot 必须保存：

- beat ID、start frame URL / hash 与 reference asset IDs；
- 编译后的 prompt、模型、参数、request ID、估算与实际成本；
- 尝试次数、状态、输出 URL；
- 人工审核结果与失败原因。

审核重点：人脸、建筑结构、印刷文字、拼贴布局、意外新增物体和来源标注。未通过的镜头不能进入最终合成。

## 预算纪律

- 单次预估成本超过 $5、hero 模型或累计成本异常时先确认。
- 价格不可换算为美元时，不得自动调用。
- 每镜头 3 次后停止生成并分析原因。
- demo 无实时生成结果时播放明确标注的预渲染影片。
