import type { LayoutAssetInput } from "./layout-fallback";

/**
 * Client-side numbered contact sheet of the real cutouts. This is the ONLY
 * pixel data a generative model ever sees, and only to propose a layout
 * reference — final frames are always composed from the untouched PNGs.
 */
export async function buildContactSheet(
  assets: LayoutAssetInput[],
): Promise<string> {
  const cols = Math.ceil(Math.sqrt(assets.length));
  const rows = Math.ceil(assets.length / cols);
  const tile = 320;
  const canvas = document.createElement("canvas");
  canvas.width = cols * tile;
  canvas.height = rows * tile;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const images = await Promise.all(
    assets.map(
      (a) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = a.cutout;
        }),
    ),
  );

  images.forEach((img, i) => {
    const cx = (i % cols) * tile;
    const cy = Math.floor(i / cols) * tile;
    const pad = 28;
    const fit = Math.min((tile - pad * 2) / img.width, (tile - pad * 2) / img.height);
    const w = img.width * fit;
    const h = img.height * fit;
    ctx.strokeStyle = "#cccccc";
    ctx.strokeRect(cx + 4, cy + 4, tile - 8, tile - 8);
    ctx.drawImage(img, cx + (tile - w) / 2, cy + (tile - h) / 2, w, h);
    ctx.fillStyle = "#a5432c";
    ctx.font = "bold 34px monospace";
    ctx.fillText(String(i + 1), cx + 12, cy + 42);
  });

  return canvas.toDataURL("image/jpeg", 0.85);
}
