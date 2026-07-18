# 03 · API Routes

全部 server-side;`FAL_KEY` 只存在于环境变量,永不进入客户端 bundle、日志或 git。视频任务一律 queue(submit + 轮询),无 webhook。

| Route | 作用 |
|---|---|
| `GET  /api/places` | 地图数据:全部 place 的 slug/status/marker/tagline |
| `POST /api/research` | 加载该 place 种子档案 + 可选 Wikimedia Commons 检索(license 过滤) |
| `POST /api/contribute` | 用户上传 → 写入 place 档案(contributor:"user")+ 项目素材 |
| `POST /api/dna` | LLM 从已选素材提取 Place DNA |
| `POST /api/story` | 主人公候选 + 五幕分镜生成(LLM,输入含 place 档案与用户上传) |
| `POST /api/preprocess` | 抠图 / 毛边 / 阴影 → `assets/cutouts/` |
| `POST /api/render-frame` | 由 `spatial` 渲染 start/end frame(HyperFrames/Puppeteer 截帧) |
| `POST /api/shot/generate` | Shot Router:确定性渲染 或 fal queue submit;写回 request_id/cost |
| `GET  /api/shot/status?id=` | 轮询 fal job;完成落盘 `clips/` |
| `POST /api/assemble` | 拼接 + 旁白 + 环境声 → `final/final.mp4` |

约定:所有 route 读写 `data/` JSON 后原子写回(临时文件 + rename);LLM 调用统一封装在 `lib/llm.ts`(可切换 Claude/Gemini);fal 调用统一封装在 `lib/fal.ts`(记录 request_id、模型、参数、成本)。
