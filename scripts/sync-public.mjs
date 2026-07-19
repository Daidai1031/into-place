// Bridge repo assets into Next's public/ dir (Next only serves public/).
// Runs before `next dev` / `next build`; safe to re-run, only copies when
// source is newer. Never edit public/cutouts or public/films by hand.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function syncDir(fromRel, toRel, exts) {
  const from = path.join(root, fromRel);
  const to = path.join(root, toRel);
  if (!existsSync(from)) return 0;
  mkdirSync(to, { recursive: true });
  let copied = 0;
  for (const name of readdirSync(from)) {
    if (!exts.some((e) => name.toLowerCase().endsWith(e))) continue;
    const src = path.join(from, name);
    const dst = path.join(to, name);
    if (!statSync(src).isFile()) continue;
    if (existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs) continue;
    copyFileSync(src, dst);
    copied++;
  }
  return copied;
}

const cutouts = syncDir("assets/cutouts", "public/cutouts", [".png"]);
const films = syncDir("final", "public/films", [".mp4"]);
console.log(`[sync-public] cutouts: ${cutouts} copied, films: ${films} copied`);
