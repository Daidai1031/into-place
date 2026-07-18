# 05 · 素材预处理、音频与文件约定

## 素材预处理

- 抠图:rembg 本地(默认)或 fal 抠图端点(Day 0 比较质量);
- 毛边:canvas 蒙版模拟撕纸边缘;
- 纸张质感:轻微投影 + 1–2px 白边,营造剪贴厚度;
- 输出 `assets/cutouts/{asset_id}_{part}.png`,透明背景;
- 档案图在确定性视差镜头中**不得经过任何生成式处理**;生成产物永不标记为档案,UI 必须标注。

## 音频

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
