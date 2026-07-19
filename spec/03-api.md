# 03 · API Routes(2026-07-19 与实现同步)

全部 server-side;`FAL_KEY` 只存在于环境变量,永不进入客户端 bundle、日志或 git(每次 build 后 grep `.next/static` 验证)。视频任务一律 queue(submit + 轮询),无 webhook。

**环境分裂机制**:`lib/capabilities.ts` 以 `!process.env.VERCEL` 判定 `isLocal / canRunPipeline / canWriteFs`;`GET /api/capabilities` 只暴露布尔值。所有 route 内部按此分支——Vercel 上模拟/只读,本地真写文件;客户端代码两端一致。**localStorage 是用户态唯一真值**(选素材/调参/上传/story/layout/影片库),`data/project.json` 只是本地供渲染管线消费的镜像。

## 已实现

| Route | 作用 | Vercel 行为 |
|---|---|---|
| `GET  /api/places` | 地图数据:全部 place 的 slug/status/marker/tagline | 同本地 |
| `GET  /api/place/[slug]` | 单个 place 完整档案 | 同本地 |
| `GET  /api/capabilities` | 环境能力布尔值(不含任何密钥) | 同本地 |
| `POST /api/preprocess` | 记录单素材 tone/edge 覆盖 | 本地写 `data/preprocess/overrides.json`;线上 echo(CSS 预览即体验) |
| `POST /api/story/generate` | phase=directions:3 个故事走向;phase=beats:5–8 条 beat(fal `any-llm`,`anthropic/claude-sonnet-4.5`,$0.001–0.01/req) | 同本地(文本调用 serverless 可跑) |
| `POST /api/story/reroll` | 单 beat 重写(mode=reroll)或插入新 beat(mode=insert_after) | 同本地 |
| `POST /api/storyboard/layout` | 布局:客户端 contact sheet → `nano-banana/edit` 参考稿($0.0398/图,仅参考、折叠展示、明确标注)→ `any-llm/vision` 输出布局 JSON → sanitize;任何失败回退 `lib/layout-fallback.ts` 确定性排版 | 同本地 |
| `POST /api/transition/suggest` | 相邻 beat 间转场类型+意图一句话(LLM) | 同本地 |
| `POST /api/generate/start` | 返回进度 step 计划 + filmUrl;进度由客户端演出 | 本地:原子写 `data/project.json` + `data/scenes/generated/<slug>/beat_NN.json`(经 `lib/layout-to-scene.ts` 转 spec/01 格式);线上:只返回预渲染片 URL |
| `POST /api/project/save` | 浏览器 project 状态镜像到 `data/project.json` | 线上 no-op |

## Stub(501,保留 spec 名)

`POST /api/research`(Wikimedia 检索)· `POST /api/dna` · `POST /api/contribute`(上传现走浏览器存储)· `POST /api/render-frame` · `POST /api/shot/generate` · `GET /api/shot/status` · `POST /api/assemble`(被 `/api/generate/*` 取代)· `GET /api/generate/status`(进度客户端驱动,恒返 done)

约定:本地写文件一律原子写回(临时文件 + rename);LLM 调用封装在 `lib/llm.ts`(结构化 prompt 构建 + JSON 提取修复),fal client 封装在 `lib/fal-server.ts`(`import "server-only"`);LLM/图像调用的 requestId 随响应返回以便追溯。
