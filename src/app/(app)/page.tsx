import Link from "next/link";
import { requireSuperadmin } from "@/lib/require-superadmin";
import { NewChain } from "@/components/NewChain";

const PAGE_SIZE = 25;

type ChainRow = {
  id: number;
  slug: string;
  description: string | null;
  is_pinned: boolean;
  created_datetime_utc: string;
};

export default async function ChainsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { admin } = await requireSuperadmin();
  const { page: pageParam, q: qParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const q = (qParam ?? "").replace(/[,()%*\\]/g, " ").trim().slice(0, 80);

  let query = admin
    .from("humor_flavors")
    .select("id, slug, description, is_pinned, created_datetime_utc", { count: "exact" })
    .order("is_pinned", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`slug.ilike.%${q}%,description.ilike.%${q}%`);

  const { data, count, error } = await query;
  const chains = (data ?? []) as unknown as ChainRow[];

  const stepCounts = new Map<number, number>();
  if (chains.length) {
    const { data: steps } = await admin
      .from("humor_flavor_steps")
      .select("humor_flavor_id")
      .in(
        "humor_flavor_id",
        chains.map((c) => c.id)
      );
    for (const s of (steps ?? []) as { humor_flavor_id: number }[]) {
      stepCounts.set(s.humor_flavor_id, (stepCounts.get(s.humor_flavor_id) ?? 0) + 1);
    }
  }

  const qs = q ? `&q=${encodeURIComponent(q)}` : "";
  const total = count ?? chains.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Prompt chains</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {total.toLocaleString("en-US")} chain{total === 1 ? "" : "s"}. Open one to edit its steps, run it, and see the
            captions it made.
          </p>
        </div>
        <NewChain />
      </div>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search chains…"
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <button className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700">Search</button>
        {q && (
          <Link href="/" className="px-3 py-2 text-sm underline">
            Clear
          </Link>
        )}
      </form>

      {error && <p className="text-red-600 dark:text-red-400">{error.message}</p>}

      <ul className="space-y-3">
        {chains.map((c) => (
          <li key={c.id}>
            <Link
              href={`/chains/${c.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-300"
            >
              <p className="break-all font-medium">
                {c.is_pinned && <span title="Pinned">📌 </span>}
                {c.slug}
              </p>
              {c.description && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{c.description}</p>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                #{c.id} · {stepCounts.get(c.id) ?? 0} step{(stepCounts.get(c.id) ?? 0) === 1 ? "" : "s"} · created{" "}
                {c.created_datetime_utc.slice(0, 10)}
              </p>
            </Link>
          </li>
        ))}
        {chains.length === 0 && <li className="text-gray-500 dark:text-gray-400">No chains found.</li>}
      </ul>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">Page {page}</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={`/?page=${page - 1}${qs}`} className="rounded border border-gray-300 px-3 py-1 dark:border-gray-700">
              Previous
            </Link>
          )}
          {chains.length === PAGE_SIZE && (
            <Link href={`/?page=${page + 1}${qs}`} className="rounded border border-gray-300 px-3 py-1 dark:border-gray-700">
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
