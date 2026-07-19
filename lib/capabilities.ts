import "server-only";

/**
 * The Vercel-vs-local split. Online: read-only fs, no render pipeline —
 * Generate plays the pre-rendered film behind the same UI. Locally the
 * pipeline really runs. Booleans only; never expose secrets.
 */
export function getCapabilities() {
  const isLocal = !process.env.VERCEL;
  return {
    isLocal,
    canRunPipeline: isLocal,
    canWriteFs: isLocal,
    hasFal: Boolean(process.env.FAL_KEY),
  };
}
