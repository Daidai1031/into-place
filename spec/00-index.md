# SPEC 索引

本文件夹是实现的唯一权威;与 PRD/调研文档冲突时以此为准。版本 V1.1(Hackathon MVP)。

| 文件 | 内容 |
|---|---|
| `01-data-model.md` | Project / Place / Asset / Scene / Shot 数据结构 |
| `02-ui-pages.md` | 地图落地页 + 4 个工作页的规格 |
| `03-api.md` | Server routes 与安全约定 |
| `04-shot-router.md` | 镜头类型 → 引擎/模型路由,prompt 编译规则 |
| `05-assets-audio-files.md` | 素材预处理、音频、文件目录约定 |
| `06-place-case.md` | 首个案例(Roosevelt Island)五幕大纲;沙溪备选;共创档案机制 |

## 全局不实现清单

Three.js / XYZ 拖拽 / 摄影机关键帧编辑器 · 时间线编辑器 · 积分任务系统 · 版本分支 · 用户账户与权限 · webhook(用轮询)· Mapbox/真实地图瓦片 · 自动版权判定 · 本地部署视频模型 · Preview.io 集成(无 API,竞品定位见 06)。

## 竞争定位一句话(用于 demo 与 repo)

通用 AI 分镜工作台(如 Preview.io)帮你更快地生成任何画面;Into Place 只帮你讲述**一个真实地方**——素材必须有来源,视差镜头零生成、零幻觉,个人照片成为地方公共档案的一部分。
