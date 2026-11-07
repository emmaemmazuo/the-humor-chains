"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/require-superadmin";
import { insertRow } from "@/lib/db";

type Result = { error?: string; success?: boolean; id?: number };
type ChainInput = { slug: string; description: string; isPinned: boolean };

function check(input: ChainInput): { error: string } | { slug: string; description: string | null } {
  const slug = String(input.slug ?? "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
    return { error: "Use a slug of lowercase letters, numbers and dashes (for example: dad-jokes-v2)." };
  }
  const description = String(input.description ?? "").trim();
  if (description.length > 2000) return { error: "Description must be 2000 characters or fewer." };
  return { slug, description: description || null };
}

export async function createChain(input: ChainInput): Promise<Result> {
  const { user, admin } = await requireSuperadmin();
  const checked = check(input);
  if ("error" in checked) return { error: checked.error };

  const { data, error } = await insertRow(admin, "humor_flavors", {
    slug: checked.slug,
    description: checked.description,
    is_pinned: input.isPinned === true,
    created_by_user_id: user.id,
    modified_by_user_id: user.id,
  });
  if (error) {
    return { error: error.code === "23505" ? "That slug is already used by another chain." : error.message };
  }

  revalidatePath("/");
  return { success: true, id: Number((data as { id: number }).id) };
}

export async function updateChain(id: number, input: ChainInput): Promise<Result> {
  const { user, admin } = await requireSuperadmin();
  if (!Number.isSafeInteger(id) || id <= 0) return { error: "Invalid chain." };
  const checked = check(input);
  if ("error" in checked) return { error: checked.error };

  const { data, error } = await admin
    .from("humor_flavors")
    .update({
      slug: checked.slug,
      description: checked.description,
      is_pinned: input.isPinned === true,
      modified_by_user_id: user.id,
      modified_datetime_utc: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error) {
    return { error: error.code === "23505" ? "That slug is already used by another chain." : error.message };
  }
  if (!data || data.length === 0) return { error: "Chain not found." };

  revalidatePath("/");
  revalidatePath(`/chains/${id}`);
  return { success: true };
}

export async function deleteChain(id: number): Promise<Result> {
  const { admin } = await requireSuperadmin();
  if (!Number.isSafeInteger(id) || id <= 0) return { error: "Invalid chain." };

  const { data, error } = await admin.from("humor_flavors").delete().eq("id", id).select("id");
  if (error) {
    return {
      error:
        error.code === "23503"
          ? `Other data still points at this chain, so the database won't delete it. (${error.message})`
          : error.message,
    };
  }
  if (!data || data.length === 0) return { error: "Chain not found." };

  revalidatePath("/");
  return { success: true };
}
