# 04 · Shot Router 与 Prompt 编译

## 路由表

| shot_type | 引擎 | 模型(Day 0 在 fal 核实后写入 `lib/models.ts`) | 备注 |
|---|---|---|---|
| archive_hold | deterministic | — | 极轻 dolly,档案像素零改动 |
| parallax_walk | deterministic | — | 前中后景速度差 |
| dolly / crane_out | deterministic | — | |
| material_transformation | fal_flf | Kling FLF(候选) | 石块堆叠 / 木屑聚合,首尾帧必备 |
| push_through | fal_flf | Veo 3.1 FLF(仅 hero)/ Kling FLF(测试) | 首尾帧必备 |
| breathing_photo | fal_i2v | Kling I2V 弱运动 / Vidu small(候选) | 可选,历史照片微动 |

规则:文档中的端点名是调研记录,**必须先经 fal Sandbox/MCP 核实存在性与当日价格**,再作为常量写入 `lib/models.ts`;禁止在代码中硬编码猜测端点。

## 确定性引擎(HyperFrames)

- 输入:`spatial.planes`(分层 PNG + z/x/y/scale/shadow)+ `camera_path`;
- 实现:HTML 模板,planes 映射为 `translateZ` 不同的绝对定位图层,摄影机 = 容器 transform 缓动;HyperFrames CLI 逐帧渲染为 MP4;
- 回退:Puppeteer 截帧序列 + FFmpeg 合成(同一 HTML,格式不变);
- 同一场景 `render-frame` 截取首/尾静帧,供 fal 转场使用,保证镜头衔接。

## Prompt 编译(`lib/prompt-compiler.ts`)

从 shot JSON 编译,不手写:

1. camera 段(一个镜头只描述**一个主要摄影机动作**);
2. layers 段(前/中/后景 + 相对速度:foreground fast, midground moderate, background nearly fixed);
3. object_motion 段(与 camera motion 分开;禁止 "everything moves dynamically");
4. preservation 固定块(所有生成镜头必带):
   `no morphing, no new objects, no face changes, no costume changes, no architecture changes, preserve printed text, preserve collage layout`
5. 音频固定块:`Diegetic sounds only. No music. No dialogue. No subtitles.`
6. style 段:`handmade archival collage, paper cutout, 8 fps stop-motion feeling`。

## 预算纪律(路由器强制)

测试参数上限 5s / 720p / 16:9;`attempts >= max_attempts(3)` 时拒绝生成并提示改 collage;Veo 端点仅当 shot 被标记 `hero: true` 时可选;单次预估 > $2 需人工确认;每次调用的成本写入 `generation.cost_usd`。
