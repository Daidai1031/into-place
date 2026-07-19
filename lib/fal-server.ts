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
