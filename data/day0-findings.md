# Day 0 调研:fal 上支持首尾帧(start+end frame)的 image-to-video 模型

来源:fal MCP `search_models` / `get_model_schema` / `get_pricing`,2026-07-18 查询,仅查价未执行任何生成任务。价格随时可能变动,正式调用前按 CLAUDE.md 规则 1 重新核价。

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

## 建议的日常测试候选(符合 CLAUDE.md §fal 使用纪律:5s/720p/16:9 上限)

按单价从低到高:`fal-ai/pixverse/v6/transition`($0.005/s)→ `fal-ai/framepack/flf2v`($0.0333/s,480p)→ `fal-ai/kling-video/v2.5-turbo/pro/image-to-video`($0.07/s)→ `fal-ai/wan-flf2v`($0.40/video 封顶)。Veo 3.1 系列仅用于 scene_04 hero shot,且需在调用前确认单次成本不超过 $2 或先向开发者确认。
