# 05 · 素材预处理、音频与文件约定

## 素材预处理

### 固定处理顺序

```text
来源审核 → EXIF 摆正 → 语义 crop → 不放大尺寸门 → 本地 tone
→ fal/local mask → 本地 edge → 白边/阴影 → 自动 QA
→ 人工 contact sheet 审核 → staging 原子发布
```

- 每个输出由声明式 recipe 驱动。recipe 必须写明素材身份、保留与排除内容、摆正后的归一化 crop、`card | cutout | bg` 角色、默认 tone/edge、mask prompt/ROI、回退策略、输出路径、`sourceSha256`、`recipeSha256` 和审核状态;不得在批处理脚本中另建隐式分流表。
- 所有 resize 都必须禁止放大。默认最大长边 2400px,大图 recipe 可明确提高;低分辨率素材只记录质量警告并限制场景放大,**禁止调用超分模型**。
- fal 只用于主体蒙版。调用前用 fal MCP 核对端点 schema 与当日价格;SAM 请求必须显式 `apply_mask:false`,不得把档案 RGB 交给模型重绘。返回 mask 缩放到本地工作尺寸后只写入 alpha。
- 单个 mask 最多两次提示/ROI 尝试。失败顺序固定为 fal SAM → 本地 silueta/rembg → 裁剪纸卡;自动 QA 不合格时不得静默发布。request_id、模型、参数、核价时间与成本必须进入 provenance,严禁记录密钥。
- `source | mono | sepia` 调色、`scissor | torn | none` 边缘、1–2px 白边和轻微投影均为本地确定性像素操作。`scissor` 是阈值化硬边加轻微抗锯齿;`torn` 用稳定 seed 对带透明 padding 的 alpha 边界做多尺度不规则侵蚀,同一输入与 recipe 重跑必须一致。
- 默认值:历史素材 `mono`,现代照片 `source`;`card` 使用 `torn`,`cutout` 使用 `scissor`,`bg` 使用 `none`。未来 UI 可做全局选择与单素材覆盖,但不得改写 recipe 默认值。
- 文件名必须带角色后缀:`assets/cutouts/{asset_id}_{part}_card.png`、`..._cutout.png` 或 `..._bg.png`;角色已有语义时不得省略后缀。`card` 可有透明撕纸外缘,`cutout` 必须是透明主体,`bg` 无边缘和阴影。
- 缓存命中必须同时匹配 source hash、recipe hash、工具版本和 mask 配置;普通 `--force` 只重做本地像素阶段,只有显式 `--refresh-mask` 可以再次提交 fal。发布前先在 staging 生成并完成 QA,再原子替换正式输出。
- 自动 QA 至少检查 alpha 非空、覆盖率、bbox、连通区域、尺寸和原始 RGB 来源;人工 contact sheet 同屏比较原图、crop、mask、hard 与 torn 结果。
- 来源/crop 审核与产物视觉审核分开记录。视觉拒绝必须写 `review.visual: rejected`、`publish:false` 和 `fallbackRecipeId`;被拒绝 mask/provenance 仅保留在 `data/preprocess/` 供追溯,不得进入正式 cutouts、manifest 或场景。review/publish 状态不参与像素 recipe hash,避免审核动作使已付费 mask 失效。
- `asset_013` 是扫描 PDF,未人工指定目标页码前跳过且不产生输出。

预处理选择的公共接口:

```ts
type TonePreset = "source" | "mono" | "sepia";
type EdgeStyle = "scissor" | "torn" | "none";

type PreprocessSelection = {
  tone?: "defaults" | TonePreset;
  edge?: "defaults" | EdgeStyle;
  overrides?: Record<string, {
    tone?: TonePreset;
    edge?: EdgeStyle;
  }>;
};
```

`materializeCutout(recipeIdOrRecipe, selection = {}, context = {})` 必须只读取本地原始素材、声明式 recipe 和已缓存 mask,并返回确定性产物及 QA/provenance。传 recipe id 时默认从 `data/preprocess/roosevelt-island.json` 解析;视觉拒绝的 recipe 除 contact-sheet 预览外必须拒绝物化。该接口为后续 UI/API 复用,当前阶段不实现选择页面。

## 音频

生成镜头(fal_i2v/fal_flf)输出始终不带声音/字幕;这样 TTS 旁白反复改词、字幕校对不需要重跑视频生成(省钱且更稳),字幕也能保证与档案原文逐字一致——这是既定策略,不是临时限制。

- 旁白:fal TTS 端点(Day 0 核实)或自录兜底;五幕各一两句;
- 环境声(Roosevelt Island):缆车电机嗡鸣、East River 水声与风、海鸥、废墟内的空旷混响、远处曼哈顿车流——**优先自己上岛实录**,freesound 公共素材补齐;
- FFmpeg 混音;声音与场景对应(靠近废墟场景时环境声切换),不做完整空间音频;
- 全片默认无配乐;模型原生音轨一律禁用(prompt 固定块)。

## 目录约定

```text
data/places/{slug}.json        data/project.json        data/day0-findings.md
assets/archive/   assets/user/   assets/cutouts/
renders/{scene}_start.png  {scene}_end.png  {scene}_depth.png(灰度,MVP 只存不用)
clips/{scene}.mp4
audio/narration.mp3   audio/ambient/*.wav
final/final.mp4
```

depth guide 规则:白=近景、灰=中景、黑=远景;由 `spatial.planes` 的 z 值自动栅格化,零额外成本,为未来 depth-condition 模型保留数据结构。
