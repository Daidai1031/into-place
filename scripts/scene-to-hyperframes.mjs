#!/usr/bin/env node
// 把我们自己的场景格式(data/scenes/*.json,跟 spec/01 的 spatial 字段一致)翻译成
// HyperFrames 能吃的 composition HTML(data-* 属性 + GSAP timeline)。
//
// 分层文件(assets/cutouts/*.png + data/scenes/*.json)还是唯一源文件——这个脚本只是把同一份数据
// 换一种渲染后端的表达方式,不改变"层是源头"这条规则。真要改构图,还是回去改 .json 或换 cutout 图。
//
// 用法:
//   node scripts/scene-to-hyperframes.mjs --scene data/scenes/test-collage.json \
//     --duration 5 --project E:/temp/claude/hf-spike --out index.html
//
// --project 指向一个已经用 `npx hyperframes init` 建好的项目目录(里面有 hyperframes.json/package.json);
// 这个脚本会把场景里引用的 cutout 图片复制进 <project>/assets/,再把翻译好的 HTML 写到 <project>/<out>。

import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEPTH_UNIT = 900; // 跟 scene-template.mjs 保持一致的单位换算,两边视觉效果才对得上
const PLANE_XY_UNIT = 500;

function parseArgs(argv) {
  const args = { duration: 5, out: "index.html", width: 1280, height: 720 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--scene") args.scene = argv[++i];
    else if (a === "--project") args.project = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--duration") args.duration = Number(argv[++i]);
    else if (a === "--width") args.width = Number(argv[++i]);
    else if (a === "--height") args.height = Number(argv[++i]);
  }
  return args;
}

const EASING_TO_GSAP = {
  "ease-in-out": "power2.inOut",
  linear: "none",
  "ease-in": "power2.in",
  "ease-out": "power2.out",
};

export async function sceneToHyperframes({ scene: scenePath, project, out, duration, width, height }) {
  if (!scenePath || !project) throw new Error("需要 --scene 和 --project");

  const raw = await readFile(scenePath, "utf-8");
  const scene = JSON.parse(raw);
  if (!Array.isArray(scene.planes) || scene.planes.length === 0) {
    throw new Error(`${scenePath} 里没有 planes`);
  }

  const assetsDir = path.join(project, "assets");
  await mkdir(assetsDir, { recursive: true });

  // 把每层引用的 cutout 图复制进项目的 assets/ 目录,组合里用相对路径引用(HyperFrames 项目是要能独立
  // 跑 preview/render 的,不依赖我们仓库根目录下的绝对路径)。
  const projectRoot = process.cwd();
  const planeEntries = await Promise.all(
    scene.planes.map(async (p, i) => {
      const srcAbs = path.resolve(projectRoot, p.asset);
      const destName = `plane_${i}_${path.basename(p.asset)}`;
      await copyFile(srcAbs, path.join(assetsDir, destName));
      return { ...p, assetRelPath: `assets/${destName}` };
    })
  );

  const planeHtml = planeEntries
    .map((p, i) => {
      const tz = (p.z ?? 0) * DEPTH_UNIT;
      const tx = (p.x ?? 0) * PLANE_XY_UNIT;
      const ty = (p.y ?? 0) * PLANE_XY_UNIT;
      const scale = p.scale ?? 1;
      const dropShadow = p.shadow
        ? `filter: drop-shadow(0 ${Math.round(8 + (p.z ?? 0) * 20)}px ${Math.round(
            10 + (p.z ?? 0) * 14
          )}px rgba(0,0,0,${(0.25 + (p.z ?? 0) * 0.2).toFixed(2)}));`
        : "";
      // 每一层本身在整段时长里都是"在场"的,只有相机(#world)在动,所以每层的 data-duration 就是整段时长。
      return `<img class="clip plane" id="plane${i}" data-start="0" data-duration="${duration}" data-track-index="${i}"
        src="${p.assetRelPath}"
        style="position:absolute;left:50%;top:50%;z-index:${i};max-width:none;
        transform: translate(-50%,-50%) translateZ(${tz}px) translateX(${tx}px) translateY(${ty}px) scale(${scale});
        ${dropShadow}" />`;
    })
    .join("\n      ");

  const cam = scene.camera_path ?? { from: {}, to: {} };
  const from = cam.from ?? {};
  const to = cam.to ?? {};
  const ease = EASING_TO_GSAP[cam.easing] ?? "power2.inOut";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: #0d0d0d; }
      #stage { width: ${width}px; height: ${height}px; overflow: hidden; perspective: 1400px; perspective-origin: 50% 50%; position: relative; }
      #world { position: absolute; inset: 0; transform-style: preserve-3d; }
      .plane { position: absolute; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${duration}" data-width="${width}" data-height="${height}">
      <div id="stage">
        <div id="world">
          ${planeHtml}
        </div>
      </div>
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      // 相机路径:直接用 GSAP 的 x/y/z 简写动画 #world 的 translateX/Y/Z,不用手算每帧的 transform 字符串——
      // #world 已经是 transform-style:preserve-3d,GSAP 会把 z/x/y 正确合成进同一个 3D transform。
      tl.fromTo(
        "#world",
        { z: ${(from.z ?? 0) * DEPTH_UNIT}, x: ${(from.x ?? 0) * PLANE_XY_UNIT}, y: ${(from.y ?? 0) * PLANE_XY_UNIT} },
        { z: ${(to.z ?? 0) * DEPTH_UNIT}, x: ${(to.x ?? 0) * PLANE_XY_UNIT}, y: ${(to.y ?? 0) * PLANE_XY_UNIT}, duration: ${duration}, ease: "${ease}" },
        0
      );
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;

  const outPath = path.join(project, out);
  await writeFile(outPath, html, "utf-8");
  console.log(`✓ ${outPath}(${planeEntries.length} 层,${duration}s,资源复制进 ${assetsDir}）`);
  return outPath;
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  sceneToHyperframes(args).catch((err) => {
    console.error("翻译失败:", err.message);
    process.exit(1);
  });
}
