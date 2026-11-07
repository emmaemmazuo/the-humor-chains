"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/require-superadmin";
import type { ImageChoice } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RunStepResult =
  | { success: true; output: string; modelUsed: string; note: string | null }
  | { success: false; error: string };

export type SaveResult = { success: true; saved: number } | { success: false; error: string };

export async function searchImages(query: string): Promise<ImageChoice[]> {
  const { admin } = await requireSuperadmin();
  const q = String(query ?? "").replace(/[,()%*\\]/g, " ").trim().slice(0, 80);

  let req = admin
    .from("images")
    .select("id, url, image_description")
    .not("url", "is", null)
    .or("is_public.eq.true,is_common_use.eq.true")
    .order("created_datetime_utc", { ascending: false })
    .limit(24);
  if (q) req = req.ilike("image_description", `%${q}%`);

  const { data } = await req;
  return ((data ?? []) as { id: string; url: string; image_description: string | null }[])
    .filter((r) => typeof r.url === "string" && r.url.startsWith("https://"))
    .map((r) => ({ id: r.id, url: r.url, description: r.image_description }));
}

async function fetchImage(url: string | undefined): Promise<{ mime: string; data: string } | { error: string }> {
  if (!url || !/^https:\/\//i.test(url)) return { error: "This image has no usable https URL." };
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return { error: "The image URL is not valid." };
  }
  if (/^(localhost$|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || host === "::1" || host.endsWith(".local")) {
    return { error: "That image host is not allowed." };
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { error: `Could not download the image (${res.status}).` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 8 * 1024 * 1024) return { error: "The image is empty or larger than 8 MB." };
    let mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!mime.startsWith("image/")) {
      const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
      mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
    }
    return { mime, data: buf.toString("base64") };
  } catch {
    return { error: "Could not download the image in time." };
  }
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  promptFeedback?: { blockReason?: string };
};

async function errorText(res: Response) {
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    return String(json?.error?.message ?? "").slice(0, 300);
  } catch {
    return "";
  }
}

// Runs ONE step. The browser calls this once per step so progress is visible.
export async function runStep(
  chainId: number,
  stepId: number,
  imageId: string,
  previousOutputs: string[]
): Promise<RunStepResult> {
  const { admin } = await requireSuperadmin();
  if (!process.env.GEMINI_API_KEY) return { success: false, error: "GEMINI_API_KEY is not set on the server." };
  if (!Number.isSafeInteger(chainId) || !Number.isSafeInteger(stepId)) return { success: false, error: "Invalid step." };
  if (!UUID.test(String(imageId))) return { success: false, error: "Pick an image first." };
  if (!Array.isArray(previousOutputs) || previousOutputs.length > 20) {
    return { success: false, error: "Invalid previous outputs." };
  }
  const outputs = previousOutputs.map((o) => String(o ?? "").slice(0, 20000));

  const { data: stepData } = await admin
    .from("humor_flavor_steps")
    .select("llm_system_prompt, llm_user_prompt, llm_temperature, llm_model_id, llm_input_type_id, llm_output_type_id")
    .eq("id", stepId)
    .eq("humor_flavor_id", chainId)
    .maybeSingle();
  if (!stepData) return { success: false, error: "Step not found in this chain." };
  const step = stepData as {
    llm_system_prompt: string | null;
    llm_user_prompt: string | null;
    llm_temperature: number | string | null;
    llm_model_id: number;
    llm_input_type_id: number;
    llm_output_type_id: number;
  };

  const { data: modelData } = await admin
    .from("llm_models")
    .select("name, provider_model_id, llm_provider_id")
    .eq("id", step.llm_model_id)
    .maybeSingle();
  const model = modelData as { name: string; provider_model_id: string; llm_provider_id: number } | null;
  let providerName = "";
  if (model) {
    const { data: p } = await admin.from("llm_providers").select("name").eq("id", model.llm_provider_id).maybeSingle();
    providerName = String((p as { name?: string } | null)?.name ?? "");
  }

  // Build the prompt: fill in ${step1Output}, ${step2Output}...; otherwise append the last output.
  const raw = step.llm_user_prompt ?? "";
  const hasPlaceholder = /\$\{step\d+Output\}/.test(raw);
  let prompt = raw.replace(/\$\{step(\d+)Output\}/g, (_m, n: string) => outputs[Number(n) - 1] ?? "");
  if (!hasPlaceholder && outputs.length > 0) {
    prompt = `${prompt}\n\nPrevious step output:\n${outputs[outputs.length - 1]}`.trim();
  }
  const asArray = step.llm_output_type_id === 2;
  if (asArray) prompt += "\n\nRespond with only a JSON array of strings and no other text.";
  if (!prompt.trim()) prompt = "Continue.";

  const parts: unknown[] = [];
  if (step.llm_input_type_id === 1) {
    const { data: img } = await admin.from("images").select("url").eq("id", imageId).maybeSingle();
    const fetched = await fetchImage((img as { url?: string } | null)?.url);
    if ("error" in fetched) return { success: false, error: fetched.error };
    parts.push({ inline_data: { mime_type: fetched.mime, data: fetched.data } });
  }
  parts.push({ text: prompt });

  const temperature = step.llm_temperature === null ? null : Number(step.llm_temperature);
  const generationConfig: Record<string, unknown> = { maxOutputTokens: 4096 };
  if (temperature !== null && Number.isFinite(temperature)) generationConfig.temperature = temperature;
  if (asArray) generationConfig.responseMimeType = "application/json";

  const body: Record<string, unknown> = { contents: [{ role: "user", parts }], generationConfig };
  if (step.llm_system_prompt?.trim()) body.system_instruction = { parts: [{ text: step.llm_system_prompt }] };

  const isGoogle = providerName.toLowerCase() === "google";
  const requested = model?.provider_model_id ?? null;
  const fallback = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const base = Array.from(
    new Set([isGoogle ? requested : null, fallback, "gemini-3.1-flash-lite", "gemini-flash-latest"].filter(Boolean))
  ) as string[];
  const candidates = [...base, ...base];
  const started = Date.now();

  let lastStatus = 0;
  for (let attempt = 0; attempt < candidates.length; attempt++) {
    const m = candidates[attempt];
    if (attempt === base.length) await new Promise((r) => setTimeout(r, 3000));
    if (Date.now() - started > 100000) break;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      lastStatus = res.status;
      if (!res.ok) {
        if ([404, 429, 500, 503].includes(res.status)) continue;
        return { success: false, error: `Gemini error ${res.status}: ${await errorText(res)}` };
      }
      const data = (await res.json()) as GeminiResponse;
      const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
      if (!text) {
        const reason = data.promptFeedback?.blockReason;
        return { success: false, error: reason ? `Gemini blocked this request (${reason}).` : "Gemini returned no text." };
      }

      let note: string | null = null;
      if (model && !isGoogle) {
        note = `This step is set to ${model.name} (${providerName}), but this tool only has a Gemini key, so it ran with ${m}.`;
      } else if (isGoogle && requested && requested !== m) {
        note = `${requested} isn't available on this key, so this step ran with ${m}.`;
      }
      return { success: true, output: text, modelUsed: m, note };
    } catch {
      continue;
    }
  }
  return { success: false, error: `Gemini is unavailable right now (${lastStatus || "timeout"}). Try again in a minute.` };
}

export async function saveCaptions(
  chainId: number,
  imageId: string,
  captions: string[],
  modelUsed: string | null
): Promise<SaveResult> {
  const { user, admin } = await requireSuperadmin();
  if (!Number.isSafeInteger(chainId) || chainId <= 0) return { success: false, error: "Invalid chain." };
  if (!UUID.test(String(imageId))) return { success: false, error: "Invalid image." };
  if (!Array.isArray(captions)) return { success: false, error: "Nothing to save." };

  const clean = captions
    .map((c) => String(c ?? "").trim())
    .filter(Boolean)
    .map((c) => c.slice(0, 500))
    .slice(0, 20);
  if (clean.length === 0) return { success: false, error: "There are no captions to save." };

  const rows = clean.map((content) => ({
    content,
    image_id: imageId,
    humor_flavor_id: chainId,
    profile_id: user.id,
    is_public: false,
    created_by_user_id: user.id,
    modified_by_user_id: user.id,
    metadata: { tool: "the-humor-chains", model: modelUsed },
  }));
  const { error } = await admin.from("captions").insert(rows);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/chains/${chainId}`);
  return { success: true, saved: clean.length };
}
