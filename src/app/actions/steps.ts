"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSuperadmin } from "@/lib/require-superadmin";
import { insertRow } from "@/lib/db";

type Result = { error?: string; success?: boolean };

export type StepInput = {
  description: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: string;
  modelId: number;
  inputTypeId: number;
  outputTypeId: number;
  stepTypeId: number;
  isHidden: boolean;
};

type Checked =
  | { error: string }
  | { description: string | null; system: string | null; user: string | null; temperature: number | null };

function check(input: StepInput): Checked {
  const description = String(input.description ?? "").trim();
  const system = String(input.systemPrompt ?? "").trim();
  const user = String(input.userPrompt ?? "").trim();
  if (description.length > 500) return { error: "Description must be 500 characters or fewer." };
  if (system.length > 20000 || user.length > 20000) return { error: "Prompts must be 20,000 characters or fewer." };
  if (!system && !user) return { error: "Add a system prompt or a user prompt." };

  const ids = [input.modelId, input.inputTypeId, input.outputTypeId, input.stepTypeId];
  if (!ids.every((n) => Number.isSafeInteger(n) && n > 0)) {
    return { error: "Pick a model, step type, input type and output type." };
  }

  let temperature: number | null = null;
  const t = String(input.temperature ?? "").trim();
  if (t) {
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || n > 2) return { error: "Temperature must be a number from 0 to 2, or empty." };
    temperature = n;
  }
  return { description: description || null, system: system || null, user: user || null, temperature };
}

// Keeps step numbers 1, 2, 3... with no gaps.
async function renumber(admin: SupabaseClient, chainId: number) {
  const { data } = await admin
    .from("humor_flavor_steps")
    .select("id, order_by")
    .eq("humor_flavor_id", chainId)
    .order("order_by", { ascending: true })
    .order("id", { ascending: true });
  const rows = (data ?? []) as { id: number; order_by: number }[];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].order_by !== i + 1) {
      await admin.from("humor_flavor_steps").update({ order_by: i + 1 }).eq("id", rows[i].id);
    }
  }
}

export async function createStep(chainId: number, input: StepInput): Promise<Result> {
  const { user, admin } = await requireSuperadmin();
  if (!Number.isSafeInteger(chainId) || chainId <= 0) return { error: "Invalid chain." };
  const checked = check(input);
  if ("error" in checked) return { error: checked.error };

  const { data: top } = await admin
    .from("humor_flavor_steps")
    .select("order_by")
    .eq("humor_flavor_id", chainId)
    .order("order_by", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = Number((top as { order_by?: number } | null)?.order_by ?? 0) + 1;

  const { error } = await insertRow(admin, "humor_flavor_steps", {
    humor_flavor_id: chainId,
    order_by: next,
    description: checked.description,
    llm_system_prompt: checked.system,
    llm_user_prompt: checked.user,
    llm_temperature: checked.temperature,
    llm_model_id: input.modelId,
    llm_input_type_id: input.inputTypeId,
    llm_output_type_id: input.outputTypeId,
    humor_flavor_step_type_id: input.stepTypeId,
    is_hidden: input.isHidden === true,
    created_by_user_id: user.id,
    modified_by_user_id: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/chains/${chainId}`);
  return { success: true };
}

export async function updateStep(stepId: number, input: StepInput): Promise<Result> {
  const { user, admin } = await requireSuperadmin();
  if (!Number.isSafeInteger(stepId) || stepId <= 0) return { error: "Invalid step." };
  const checked = check(input);
  if ("error" in checked) return { error: checked.error };

  const { data, error } = await admin
    .from("humor_flavor_steps")
    .update({
      description: checked.description,
      llm_system_prompt: checked.system,
      llm_user_prompt: checked.user,
      llm_temperature: checked.temperature,
      llm_model_id: input.modelId,
      llm_input_type_id: input.inputTypeId,
      llm_output_type_id: input.outputTypeId,
      humor_flavor_step_type_id: input.stepTypeId,
      is_hidden: input.isHidden === true,
      modified_by_user_id: user.id,
      modified_datetime_utc: new Date().toISOString(),
    })
    .eq("id", stepId)
    .select("humor_flavor_id");
  if (error) return { error: error.message };
  const row = (data as { humor_flavor_id: number }[] | null)?.[0];
  if (!row) return { error: "Step not found." };

  revalidatePath(`/chains/${row.humor_flavor_id}`);
  return { success: true };
}

export async function deleteStep(stepId: number): Promise<Result> {
  const { admin } = await requireSuperadmin();
  if (!Number.isSafeInteger(stepId) || stepId <= 0) return { error: "Invalid step." };

  const { data, error } = await admin.from("humor_flavor_steps").delete().eq("id", stepId).select("humor_flavor_id");
  if (error) {
    return {
      error:
        error.code === "23503"
          ? `Other data still points at this step, so the database won't delete it. (${error.message})`
          : error.message,
    };
  }
  const row = (data as { humor_flavor_id: number }[] | null)?.[0];
  if (!row) return { error: "Step not found." };

  await renumber(admin, row.humor_flavor_id);
  revalidatePath(`/chains/${row.humor_flavor_id}`);
  return { success: true };
}

// Move a step up or down by swapping it with its neighbour, then renumber 1..n.
export async function moveStep(stepId: number, direction: "up" | "down"): Promise<Result> {
  const { admin } = await requireSuperadmin();
  if (!Number.isSafeInteger(stepId) || stepId <= 0) return { error: "Invalid step." };
  if (direction !== "up" && direction !== "down") return { error: "Invalid direction." };

  const { data: step } = await admin.from("humor_flavor_steps").select("humor_flavor_id").eq("id", stepId).maybeSingle();
  if (!step) return { error: "Step not found." };
  const chainId = Number((step as { humor_flavor_id: number }).humor_flavor_id);

  const { data } = await admin
    .from("humor_flavor_steps")
    .select("id, order_by")
    .eq("humor_flavor_id", chainId)
    .order("order_by", { ascending: true })
    .order("id", { ascending: true });
  const rows = (data ?? []) as { id: number; order_by: number }[];

  const i = rows.findIndex((r) => r.id === stepId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return { success: true };

  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (let k = 0; k < rows.length; k++) {
    if (rows[k].order_by !== k + 1) {
      const { error } = await admin.from("humor_flavor_steps").update({ order_by: k + 1 }).eq("id", rows[k].id);
      if (error) return { error: error.message };
    }
  }

  revalidatePath(`/chains/${chainId}`);
  return { success: true };
}
