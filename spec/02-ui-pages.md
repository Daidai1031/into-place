# 02 · 页面规格(地图落地页 + 4 个工作页)

## Page 0 — Atlas(`/`,落地页)

一张**风格化插画/拼贴风地图**(静态 SVG 或图像模型生成的底图 + 绝对定位标记,不用 Mapbox):

- 标记来自 `data/places/*.json` 的 `map_marker`;
- `seeded` 地点:点亮的拼贴风标记(缩略图 + tagline),点击进入该地点 → Page 1;
- `empty` 地点(沙溪、Camino):半透明标记,悬停显示 "Be the first to contribute";
- 底部一句平台陈述:每个人都可以为一个地方贡献图片与理解;
- 也允许直接输入一个新地点名(MVP 中提示"即将开放",不实做)。

地图本身就是共创叙事:有的地方已被点亮,有的等你来点亮。demo 开场从这里进。

## Page 1 — Research(`/p/[slug]/research`)

- 顶部:地点名 + tagline + 上传个人照片入口。上传时询问用途(bridge / protagonist_ref / texture / ending / inspiration)+ 勾选"分享进该地方的公共档案"(写入 `contributor:"user"`、`share_to_place`);
- 卡片流:种子档案 + 用户贡献混排,带 "Found: N archival photographs, M maps, K community contributions" 发现感文案;
- 卡片:缩略图 / 标题 / 年代 / 来源链接 / license / fact_level 徽章 / contributor 徽章(社区贡献显示署名);
- 操作:必用 · 可能 · 不用;
- "Search more" 按钮 → Wikimedia Commons API 实时检索(版权字段过滤;失败静默降级,按钮标 experimental)。

## Page 2 — Story & Storyboard(`/p/[slug]/story`)

- 侧栏:Place DNA 只读面板(色卡 / 材料缩略图 / 符号,LLM 从已选素材提取);
- 主区上:3 个主人公候选卡(名称 + 为什么只属于这个地方 + 风险提示),可选或自填;
- 主区下:5 张分镜卡(五幕结构),每张:标题 / 幕 / 旁白(可编辑)/ 素材缩略图(可替换为已策展素材)/ 镜头类型。

## Page 3 — Direct(`/p/[slug]/direct`)

- 每镜头一行:start/end frame 预览 · shot_type 下拉 · preservation 开关组 · 引擎徽章(Deterministic / fal + 模型名)· 时长;
- `Render this shot`:仅该镜头,其他镜头状态不变(human-in-the-loop 核心证据,demo 必演);
- 生成中轮询 queue 状态;完成后行内播放;`Regenerate`(attempts < 3,显示已花费成本)。

## Page 4 — Film(`/p/[slug]/film`)

- `Assemble Film` → 拼接 + 音频 → 播放器;
- Journey Book:全部来源列表(含社区贡献者署名)+ 生成镜头标注(哪些帧经过模型、哪些是纯档案)。

## 通用

朴素 Tailwind,不引大型组件库;拼贴美学靠纸张纹理背景、毛边卡片、衬线标题即可;好看服务于 demo 录屏。
