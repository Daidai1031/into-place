import "server-only";
import { fal } from "@fal-ai/client";

/**
 * Server-only fal client. FAL_KEY lives in .env.local / Vercel env and must
 * never reach the client bundle, logs, or git.
 */
fal.config({ credentials: process.env.FAL_KEY });

// Verified via fal MCP 2026-07-19: $0.001/request (premium models 10x).
// Output is a plain string — JSON must be prompt-enforced and repaired.
export const LLM_ENDPOINT = "fal-ai/any-llm";
export const LLM_MODEL = "anthropic/claude-sonnet-4.5";

export interface LlmResult {
  output: string;
  requestId: string;
}

export async function callLlm({
  system,
  prompt,
  maxTokens = 2000,
  temperature = 0.8,
}: {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<LlmResult> {
  const result = await fal.subscribe(LLM_ENDPOINT, {
    input: {
      model: LLM_MODEL,
      system_prompt: system,
      prompt,
      max_tokens: maxTokens,
      temperature,
      priority: "latency",
    },
  });
  const data = result.data as { output: string; error?: string | null };
  if (data.error) throw new Error(`LLM error: ${data.error}`);
  return { output: data.output, requestId: result.requestId };
}

export interface ImageResult {
  imageUrl: string;
  requestId: string;
  raw: unknown;
}

/**
 * Text-to-image / image-edit call (storyboard frames). Blocking subscribe —
 * T2I is fast. `input` is passed through verbatim so per-model param names
 * (from lib/models.ts) stay the caller's responsibility. Returns the first
 * output image url.
 */
export async function callImageModel(
  endpointId: string,
  input: Record<string, unknown>,
): Promise<ImageResult> {
  const result = await fal.subscribe(endpointId, { input });
  const data = result.data as {
    images?: { url: string }[];
    image?: { url: string };
    error?: string | null;
  };
  if (data.error) throw new Error(`Image model error: ${data.error}`);
  const imageUrl = data.images?.[0]?.url ?? data.image?.url;
  if (!imageUrl) throw new Error("Image model returned no image url");
  return { imageUrl, requestId: result.requestId, raw: result.data };
}

/** Upload a Blob (e.g. a reference cutout or contact sheet) to fal storage. */
export async function uploadToFal(blob: Blob): Promise<string> {
  return fal.storage.upload(blob);
}

/**
 * Video queue helpers (CLAUDE.md: 视频任务一律 queue 模式,submit + 轮询).
 * Submit returns a request id; the client/route polls status then fetches the
 * result — never a synchronous wait on a long video job.
 */
export async function submitVideoJob(
  endpointId: string,
  input: Record<string, unknown>,
): Promise<{ requestId: string }> {
  const { request_id } = await fal.queue.submit(endpointId, { input });
  return { requestId: request_id };
}

export async function videoJobStatus(
  endpointId: string,
  requestId: string,
): Promise<{ status: string; raw: unknown }> {
  const res = await fal.queue.status(endpointId, { requestId });
  return { status: (res as { status: string }).status, raw: res };
}

export async function videoJobResult(
  endpointId: string,
  requestId: string,
): Promise<{ videoUrl: string | null; raw: unknown }> {
  const res = await fal.queue.result(endpointId, { requestId });
  const data = res.data as { video?: { url: string } };
  return { videoUrl: data?.video?.url ?? null, raw: res.data };
}

/** Extract the first JSON object/array from an LLM reply (fences tolerated). */
export function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in LLM output");
  const opener = cleaned[start];
  const closer = opener === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(closer);
  if (end <= start) throw new Error("Unbalanced JSON in LLM output");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
