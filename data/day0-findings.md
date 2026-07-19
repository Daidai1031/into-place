# Day 0 调研:fal 上支持首尾帧(start+end frame)的 image-to-video 模型

来源:fal MCP `search_models` / `get_model_schema` / `get_pricing`,2026-07-18 查询,仅查价未执行任何生成任务。价格随时可能变动,正式调用前按 CLAUDE.md 规则 1 重新核价。

> **历史调研记录:** 本表不再充当运行时模型注册表或预算规则。当前单首帧 I2V 候选以 `lib/models.ts` 为准,确认阈值以 `CLAUDE.md` 为准。

| Endpoint ID | 模型 | 价格 | 最长时长 | 分辨率选项 | 首尾帧参数名 | 备注 |
|---|---|---|---|---|---|---|
| `fal-ai/kling-video/o1/image-to-video` | Kling O1 FLF [Pro] | $0.112/s | 3–10s | 未在 schema 中暴露(由模型固定输出) | `start_image_url` (必填) / `end_image_url` (选填) | end_image_url 选填,不填则退化为普通 i2v |
| `fal-ai/kling-video/o1/standard/image-to-video` | Kling O1 FLF [Standard] | $0.084/s | 3–10s | 未暴露 | `start_image_url` / `end_image_url`(选填) | 同上,更便宜的档位 |
| `fal-ai/kling-video/o3/pro/image-to-video` | Kling O3 [Pro] | $0.14/s | 3–15s | 未暴露 | `image_url` / `end_image_url`(选填) | 支持 `multi_prompt` 多镜头、`generate_audio` |
| `fal-ai/kling-video/o3/standard/image-to-video` | Kling O3 [Standard] | $0.14/s | 3–15s(推断,与 Pro 同 schema 族) | 未暴露 | `image_url` / `end_image_url`(选填) | 价格与 Pro 相同,需在调用前再核实是否有 standard 折扣 |
| `fal-ai/kling-video/v3/turbo/standard/image-to-video` | Kling v3.0 Turbo Standard | $0.112/s | 3–15s | 固定 720p | `image_url`(首帧必填,描述称支持尾帧但 schema 未见显式 end_image 参数,需二次确认) | 原生音频;**尾帧支持存疑,调用前需在 fal 后台或 docs 二次确认参数名** |
| `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` | Kling v2.5 Turbo Pro | $0.07/s | 5s / 10s | 未暴露 | `image_url` / `tail_image_url`(选填) | 便宜候选,适合日常测试 |
| `fal-ai/wan-flf2v` | Wan-2.1 First-Last-Frame-to-Video | $0.40/video(720p 满量;480p 半价单位) | 由 `num_frames`(81–100)+`frames_per_second`(5–24)推算,默认 81 帧 @16fps ≈ 5s | 480p / 720p | `start_image_url` / `end_image_url`(均必填) | 候选中最便宜的开源模型之一,符合日常测试预算 |
| `fal-ai/framepack/flf2v` | Framepack FLF2V | $0.0333/s(480p;720p ×1.5) | 由 `num_frames`(默认 240)推算,无显式秒数上限字段 | 480p / 720p | `image_url` / `end_image_url`(均必填) | 最便宜候选;`strength` 可调尾帧影响力 |
| `fal-ai/pixverse/v6/transition` | PixVerse V6 Transition | $0.005/s | 1–15s | 360p / 540p / 720p / 1080p | `first_image_url` / `end_image_url`(均必填) | 单价最低;支持音频、多镜头开关 |
| `fal-ai/pixverse/c1/transition` | PixVerse C1 Transition | $0.005/s | 1–15s | 360p / 540p / 720p / 1080p | `first_image_url` / `end_image_url`(均必填) | 电影级转场定位,价格与 v6 相同 |
| `bytedance/seedance-2.0/image-to-video` | Seedance 2.0 | $0.014/unit(计费单位非秒,需在 fal 文档核实换算) | 4–15s(或 auto) | 480p / 720p / 1080p / 4k | `image_url` / `end_image_url`(选填) | 支持同步音频;**单价单位是 "units" 不是秒,估算成本前必须先查换算关系** |
| `bytedance/seedance-2.0/fast/image-to-video` | Seedance 2.0 Fast | $0.0112/unit(同上,需核实单位) | 4–15s(或 auto) | 未单独确认,推断同 2.0 主档 | `image_url` / `end_image_url`(选填) | 更快更省,日常测试可优先选它而非 2.0 正式档 |
| `fal-ai/bytedance/seedance/v1.5/pro/image-to-video` | Seedance 1.5 Pro | $1.20 / 1M tokens(非秒计价,需核实典型 5s 720p 视频的 token 消耗再估算实际成本) | 4–12s | 480p / 720p / 1080p | `image_url` / `end_image_url`(选填) | 计价单位是 token,**下单前必须先估算实际美元成本**,可能超过 $2 阈值 |
| `fal-ai/veo3.1/first-last-frame-to-video` | Veo 3.1 | $0.40/s | 4s / 6s / 8s | 720p / 1080p / 4k | `first_frame_url` / `last_frame_url`(均必填) | 按 CLAUDE.md 仅用于 hero shot(scene_04);8s×720p 已 ≈$3.2,**超过 $2 阈值,使用前必须先询问开发者** |
| `fal-ai/veo3.1/fast/first-last-frame-to-video` | Veo 3.1 Fast | $0.15/s | 推断同 Veo3.1(4/6/8s) | 推断同 Veo3.1 | 推断同 `first_frame_url`/`last_frame_url` | 8s×720p ≈ $1.2,仍建议先核实 schema 细节 |
| `fal-ai/veo3.1/lite/first-last-frame-to-video` | Veo 3.1 Lite FLF | 查询时遭 API 限流(429),未取得价格 | 未确认 | 未确认 | 推断同 Veo3.1 系列 | **价格待补,使用前必须重新查询** |

## 未纳入表格但检索到的相关项(仅记录,未核实是否满足首尾帧要求)

- `fal-ai/ltx23-trainer-v2/interpolate` — 这是"训练一个关键帧插值 LoRA"的训练端点,不是直接推理用的 i2v 模型,不计入候选。
- `fal-ai/ffmpeg-api/extract-frame` — 用于从视频提取首/中/尾帧的工具端点,不是生成模型。

## 当时建议的日常测试候选（历史记录）

当时按单价比较了 PixVerse transition、Framepack FLF2V、Kling v2.5 与 Wan FLF2V。该排序和旧 $2 阈值已经失效,不得据此直接发起调用。

## 早期分层视差 spike（已退役）

Day 0 曾验证过独立的分层视差视频方案：真实档案图能够以多层相机运动输出 MP4，内容不会在该阶段被模型重绘。这个实验完成了技术验证，但产品随后转向 **approved storyboard frame → fal I2V → FFmpeg assembly**，因此相关 CLI、headless-browser 截帧脚本和 npm 依赖已于 2026-07-19 移除。

保留这条记录只为解释仓库中早期 `data/scenes/` fixture 的来源；它们不是当前运行路径，也不应重新加入依赖。实验中仍有效的 Sharp alpha 合成经验已经保留在 `CLAUDE.md` 的素材处理约定中。

## 生成式主路径端点核实（2026-07-19，fal MCP 未连接本会话）

本会话 **fal MCP 未连接**，以下端点改用 fal 模型页 + 文档核实“存在性 + 大致价格”，**未跑 get_model_schema/get_pricing**；`lib/models.ts` 中 `verifyBeforeCall:true` 的端点在首次付费调用前仍须用 fal MCP 复核参数名与当日价格。

| 用途 | Endpoint | 抓取价 | 关键参数 |
|---|---|---|---|
| T2I 默认 | `fal-ai/nano-banana-2/edit` | ~$0.04/图 | `prompt` + `image_urls`(≤14 参考图,Gemini 3.1 Flash Image)+ `aspect_ratio` |
| T2I 备选 | `fal-ai/flux-2-pro` | $0.03/首 MP + $0.015/额外 MP | `prompt`,`image_size`,参考图字段名待复核 |
| I2V 默认 | `fal-ai/kling-video/v3/turbo/standard/image-to-video` | $0.112/s | `image_url` + `prompt` + `duration`(枚举字符串)+ `generate_audio`(强制 false) |
| I2V 预算 | `alibaba/happy-horse/image-to-video` | $0.14/s@720p、$0.28@1080p | `image_url` + `prompt`(选填,≤2500 字)+ `duration`(数值 3–15)+ `resolution` |
| I2V hero | `fal-ai/veo3.1/image-to-video` | $0.20/s@720p 无音频、$0.40 有音频 | `image_url` + `prompt` + `duration`(`"8s"` 式)|

**已实跑验证:** 用 `fal-ai/nano-banana-2/edit` + 真实 cutout 参考图 + 风格锚链生成了 Roosevelt Island Direction-One 五张分镜帧(`data/storyboard-preview/`),风格统一、贴合叙事,成本远低于 $5。I2V 尚未付费实跑,`scripts/render-film.mts --yes` 待开发者放行。
