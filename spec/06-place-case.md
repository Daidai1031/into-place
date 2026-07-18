# 06 · 首个案例与共创档案机制

## 共创档案(平台机制,不是权宜之计)

Into Place 的长期形态是一个地方记忆的共创平台:任何人都可以为一个地方贡献图片、声音与理解。MVP 中:

- 种子档案由创始人策展(`contributor: "founder_seed"`),来源与 license 齐全;
- 用户上传的照片经勾选后进入该地方公共档案并署名(`contributor: "user"`);
- 地图上 `empty` 状态的地点即"等待被点亮"的共创邀请;
- Journey Book 中社区贡献与机构档案并列展示。

demo 台词:"这不是我的素材库,这是这个地方正在生长的公共记忆。"

## 主案例:Roosevelt Island(Blackwell's → Welfare → Roosevelt)

选择理由:功能四次转变(农场 → 收容之岛 → 福利机构 → 住宅社区/科技校园);公共领域档案极丰富(NYPL Digital Collections、Library of Congress、Wikimedia);开发者在纽约,可实拍现代照片与环境声;评委零解释成本。

**主人公候选(供 Narrative Agent 输出):**

1. **一块片麻岩石块**(推荐)——囚犯在岛上开采的石头,砌成了关押他们自己的高墙、Octagon 与灯塔;石头至今在防波堤和废墟里。历史相关性/材料关联/跨时代能力:高。
2. 灯塔——1872 年建,岛北端,用岛上石头砌成,伴随传说;
3. 缆车——1976 年"临时"通勤方案成为永久身份符号,连接岛与城的视角。

**五幕大纲(~31s,5 镜头):**

| # | 幕 | 内容 | 镜头 | 引擎 |
|---|---|------|------|------|
| 1 | Stasis | East River 上安静的农场小岛,Blackwell 农舍,水与风 | Slow Dolly + 轻视差 | HyperFrames |
| 2 | Peripeteia | 城市买下小岛;石块被开采、以定格方式堆叠成收容所高墙 | Material Transformation(石块堆叠) | fal FLF (Kling) |
| 3 | Pathos | 收容的世纪:疯人院(Nellie Bly 1887 卧底报道)、监狱、天花医院;地图与照片组成时间走廊,更名 Welfare Island | Parallax Walk / Time Corridor | HyperFrames |
| 4 | Anagnorisis | 穿过 1880s 天花医院档案照片的门洞 → 用户今天实拍的 Renwick 废墟/缆车照片 | Push Through(hero) | Veo 3.1 FLF |
| 5 | Katharsis | 拉远回到完整档案墙;旁白:一座为了藏起"不被想看见的人"而建的岛,如今是人们选择居住、回望城市的地方。被保存下来的是什么? | Crane Out | HyperFrames |

**种子档案清单(Phase 0 采集,12–20 张,全部公共领域):** 天花医院(Renwick)、Octagon/疯人院、监狱、灯塔、Blackwell 农舍、各时期地图(1820s–1970s)、Nellie Bly 相关报纸版面、采石场/石墙细节、早期 East River 视角版画;材质:片麻岩纹理、砖、河水。

## 备选案例:沙溪古镇(茶马古道)

主题完美(贸易路线 → 衰落 → 遗产修复 → 旅游),保留为地图上的 `empty` 标记与 V2 目标。**未启用原因:** 公共领域历史影像稀缺、版权不明,72 小时内无法完成可信的种子策展;英文评委背景成本高。切换方式:替换 `data/places/shaxi.json` 的种子档案 + 本文件的五幕大纲,代码零改动。

Camino de Santiago 同样保留为 `empty` 标记(原 PRD 案例,素材调研已完成,可作 V2 快速点亮)。
