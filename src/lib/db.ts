import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

// Some tables here may not generate their own id, so retry with the next id if needed.
export async function insertRow(admin: SupabaseClient, table: string, values: Row) {
  const first = await admin.from(table).insert(values).select("id").single();
  if (!first.error || first.error.code !== "23502" || !first.error.message.includes('"id"')) {
    return first;
  }
  const { data: top } = await admin
    .from(table)
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextId = Number((top as { id?: number } | null)?.id ?? 0) + 1;
  return admin.from(table).insert({ ...values, id: nextId }).select("id").single();
}
