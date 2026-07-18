// 场景模板:layers(spatial.planes)+ camera_path → 一帧静态渲染的 HTML。
//
// 硬规则(不要违反):分层的 cutout PNG + spatial.json 永远是场景的唯一源文件。
// 这个模块只做单向渲染(层 → 拍平的帧/视频),渲染结果只能拿去给 fal 当 start/end frame 用,
// 或者剪进最终成片——绝不能把渲染出来的拍平截图再喂给任何抠图/分割模型往回找层。
// 需要调整某一层,就去改 spatial.json 里的字段或替换对应的 assets/cutouts/*.png,重新渲染。

const DEPTH_UNIT = 900; // px,z=1(最近)相对相机的 translateZ 量,凭经验调,不是精确物理值
const PLANE_XY_UNIT = 500; // px,plane.x/y 与 camera.x/y 都是 -1..1 的归一化坐标

export function easeInOutCubic(t) {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

const lerp = (a, b, t) => a + (b - a) * t;

/** camera_path: { from: {z,x,y}, to: {z,x,y}, easing } → t(0..1) 处的相机位置(归一化单位) */
export function interpolateCamera(cameraPath, t) {
  const eased = cameraPath.easing === "linear" ? t : easeInOutCubic(t);
  const from = cameraPath.from ?? {};
  const to = cameraPath.to ?? {};
  return {
    z: lerp(from.z ?? 0, to.z ?? 0, eased),
    x: lerp(from.x ?? 0, to.x ?? 0, eased),
    y: lerp(from.y ?? 0, to.y ?? 0, eased),
  };
}

/**
 * planes: [{ asset(绝对路径), z, x, y, scale, shadow }]  z: 0=远景, 1=近景(与 spec/01 例子一致)
 * camera: interpolateCamera() 的返回值(归一化单位)
 *
 * 用真正的 CSS 3D transform-style:preserve-3d + perspective 让视差由浏览器透视投影自动算出来,
 * 不手动给每层加"速度系数"——这也是为什么这里不需要 prompt-compiler.ts 里那种
 * "foreground fast / midground moderate / background nearly fixed" 的人工描述:那是给 fal 文字提示用的,
 * 确定性渲染这边视差是几何算出来的,不是描述出来的。
 */
export function buildSceneHtml({ planes, camera, width, height, perspective = 1400 }) {
  const planeImgs = planes
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
      // p.asset 期望已经是 render-scene.mjs 用 pathToFileURL() 转好的 file:// URL 字符串
      return `<img class="plane" style="z-index:${i};transform:translate(-50%,-50%) translateZ(${tz}px) translateX(${tx}px) translateY(${ty}px) scale(${scale});${dropShadow}" src="${p.asset}" />`;
    })
    .join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  html,body{margin:0;padding:0;background:#111;}
  .stage{width:${width}px;height:${height}px;overflow:hidden;perspective:${perspective}px;perspective-origin:50% 50%;background:#0d0d0d;position:relative;}
  .world{position:absolute;inset:0;transform-style:preserve-3d;
    transform: translateZ(${camera.z * DEPTH_UNIT}px) translateX(${camera.x * PLANE_XY_UNIT}px) translateY(${camera.y * PLANE_XY_UNIT}px);}
  .plane{position:absolute;left:50%;top:50%;max-width:none;}
</style></head>
<body>
  <div class="stage"><div class="world">${planeImgs}</div></div>
</body></html>`;
}
