# 04 · Shot Router 与 Prompt 编译

## 路由表

| shot_type | 引擎 | 模型(Day 0 在 fal 核实后写入 `lib/models.ts`) | 备注 |
|---|---|---|---|
| archive_hold | deterministic | — | 极轻 dolly,档案像素零改动 |
| parallax_walk | deterministic | — | 前中后景速度差 |
| dolly / crane_out | deterministic | — | |
| material_transformation | fal_flf | Kling FLF(候选) | 石块堆叠 / 木屑聚合,首尾帧必备 |
| push_through | fal_flf | Veo 3.1 FLF(仅 hero)/ Kling FLF(测试) | 首尾帧必备 |
| breathing_photo | fal_i2v | Kling I2V 弱运动 / Vidu small(候选) | 可选,无方向性的轻微起伏(呼吸感) |
| subject_motion | fal_i2v | Kling I2V(候选) | 裁剪人物/主体的具体动作(坐下、转身、抬手),一镜头一个主动作 |
| environment_motion | fal_i2v | Kling I2V(候选) | 环境元素移动(车辆行驶、水流、缆车缆索、烟雾),与 breathing_photo 的区别是有明确方向性 |

规则:文档中的端点名是调研记录,**必须先经 fal Sandbox/MCP 核实存在性与当日价格**,再作为常量写入 `lib/models.ts`;禁止在代码中硬编码猜测端点。

## 确定性引擎(HyperFrames)

- 输入:`spatial.planes`(分层 PNG + z/x/y/scale/shadow)+ `camera_path`;
- 实现:HTML 模板,planes 映射为 `translateZ` 不同的绝对定位图层,摄影机 = 容器 transform 缓动;HyperFrames CLI 逐帧渲染为 MP4;
- 回退:Puppeteer 截帧序列 + FFmpeg 合成(同一 HTML,格式不变);
- 同一场景 `render-frame` 截取首/尾静帧,供 fal 转场使用,保证镜头衔接。

## 转场引擎

`transition.type` 默认 `push_dissolve`,现已扩展候选形式,**确定性实现优先于 fal 生成版**(省钱且不冒内容风险,遇到效果不够再升级):

| type | 确定性(HyperFrames)实现 | fal 升级路径 |
|---|---|---|
| push_dissolve | 放大穿过 + 交叉溶解(已验证的回退路径) | Kling/Veo FLF |
| page_turn | 把 outgoing plane 包一层 `transform-style:preserve-3d` 容器,GSAP tween `rotateY` 做翻页 | FLF prompt 描述 "page turning" |
| wipe | `clip-path` 从一侧展开动画 | FLF prompt 描述 "wipe reveal" |
| match_cut | outgoing/incoming 两帧在同位置同缩放处交叉切,靠 collage 布局对齐,不需要额外生成 | FLF prompt 描述 "match cut" |
| torn_reveal | 已有的撕纸蒙版图层做位移揭开 | FLF prompt 描述 "torn paper reveal" |

## Prompt 编译(`lib/prompt-compiler.ts`)

从 shot JSON 编译,不手写:

1. camera 段(一个镜头只描述**一个主要摄影机动作**);
2. layers 段(前/中/后景 + 相对速度:foreground fast, midground moderate, background nearly fixed);
3. object_motion 段:允许具体的主体/环境动作描述(人物坐下、车辆移动等),但一个镜头最多**一个相机动作 + 一个主体/环境动作**,两者分句描述,不合并成一句 "everything moves dynamically";
4. preservation 固定块(所有生成镜头必带):
   `no morphing, no new objects, no face changes, no costume changes, no architecture changes, preserve printed text, preserve collage layout`
   —— 这组约束防止的是**身份/材质被改写**(换脸、换装、建筑变形、新增物体),**不禁止**姿态/位置类动作;两者不矛盾。
5. 音频固定块:`Diegetic sounds only. No music. No dialogue. No subtitles.`
   —— 策略:生成阶段永远 mute,旁白/字幕后期用 FFmpeg 统一叠加,见 05-assets-audio-files.md。
6. style 段:`handmade archival collage, paper cutout, 8 fps stop-motion feeling`。

## 预算纪律(路由器强制)

测试参数上限 5s / 720p / 16:9;`attempts >= max_attempts(3)` 时拒绝生成并提示改 collage;Veo 端点仅当 shot 被标记 `hero: true` 时可选;单次预估 > $2 需人工确认;每次调用的成本写入 `generation.cost_usd`。
