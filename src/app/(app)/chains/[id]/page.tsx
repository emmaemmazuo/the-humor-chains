import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/require-superadmin";
import { ChainHeader } from "@/components/ChainHeader";
import { StepsEditor } from "@/components/StepsEditor";
import { RunPanel } from "@/components/RunPanel";
import type { Option, RunStepInfo, Step, StepOptions } from "@/lib/types";

// Running steps and saving captions can take a while.
export const maxDuration = 120;

const MEDIA_PAGE_SIZE = 24;

type Lookup = { id: number; slug: string | null; description: string | null };
type CaptionRow = {
  id: string;
  content: string | null;
  image_id: string | null;
  is_public: boolean;
  like_count: number | null;
  created_datetime_utc: string;
  metadata: { tool?: string } | null;
};

const toOptions = (rows: Lookup[]): Option[] =>
  rows.map((r) => ({ id: Number(r.id), label: r.slug ?? `#${r.id}`, hint: r.description ?? undefined }));

export default async function ChainPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mpage?: string }>;
}) {
  const { admin } = await requireSuperadmin();
  const { id: idParam } = await params;
  const { mpage } = await searchParams;
  const id = Number(idParam);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const page = Math.max(1, parseInt(mpage ?? "1", 10) || 1);

  const { data: chain } = await admin
    .from("humor_flavors")
    .select("id, slug, description, is_pinned")
    .eq("id", id)
    .maybeSingle();
  if (!chain) notFound();

  const [stepsRes, modelsRes, providersRes, stepTypesRes, inputTypesRes, outputTypesRes, captionsRes] = await Promise.all([
    admin
      .from("humor_flavor_steps")
      .select(
        "id, humor_flavor_id, order_by, description, llm_system_prompt, llm_user_prompt, llm_temperature, llm_model_id, llm_input_type_id, llm_output_type_id, humor_flavor_step_type_id, is_hidden"
      )
      .eq("humor_flavor_id", id)
      .order("order_by", { ascending: true })
      .order("id", { ascending: true }),
    admin.from("llm_models").select("id, name, llm_provider_id").order("id"),
    admin.from("llm_providers").select("id, name"),
    admin.from("humor_flavor_step_types").select("id, slug, description").order("id"),
    admin.from("llm_input_types").select("id, slug, description").order("id"),
    admin.from("llm_output_types").select("id, slug, description").order("id"),
    admin
      .from("captions")
      .select("id, content, image_id, is_public, like_count, created_datetime_utc, metadata", { count: "exact" })
      .eq("humor_flavor_id", id)
      .order("created_datetime_utc", { ascending: false })
      .range((page - 1) * MEDIA_PAGE_SIZE, page * MEDIA_PAGE_SIZE - 1),
  ]);

  const steps = ((stepsRes.data ?? []) as unknown as Step[]).map((s) => ({
    ...s,
    llm_temperature: s.llm_temperature === null ? null : Number(s.llm_temperature),
  }));

  const providerNames = new Map(
    ((providersRes.data ?? []) as unknown as { id: number; name: string }[]).map((p) => [Number(p.id), p.name])
  );
  const options: StepOptions = {
    models: ((modelsRes.data ?? []) as unknown as { id: number; name: string; llm_provider_id: number }[]).map((m) => ({
      id: Number(m.id),
      label: `${m.name} (${providerNames.get(Number(m.llm_provider_id)) ?? "?"})`,
    })),
    stepTypes: toOptions((stepTypesRes.data ?? []) as unknown as Lookup[]),
    inputTypes: toOptions((inputTypesRes.data ?? []) as unknown as Lookup[]),
    outputTypes: toOptions((outputTypesRes.data ?? []) as unknown as Lookup[]),
  };

  const runSteps: RunStepInfo[] = steps
    .filter((s) => !s.is_hidden)
    .map((s, i) => ({
      id: s.id,
      position: i + 1,
      description: s.description,
      inputTypeId: s.llm_input_type_id,
      outputTypeId: s.llm_output_type_id,
    }));

  const captions = (captionsRes.data ?? []) as unknown as CaptionRow[];
  const totalCaptions = captionsRes.count ?? captions.length;

  const imageIds = Array.from(new Set(captions.map((c) => c.image_id).filter(Boolean))) as string[];
  const imageUrls = new Map<string, string>();
  if (imageIds.length) {
    const { data: imgs } = await admin.from("images").select("id, url").in("id", imageIds);
    for (const img of (imgs ?? []) as { id: string; url: string }[]) imageUrls.set(img.id, img.url);
  }

  return (
    <div className="space-y-8">
      <Link href="/" className="text-sm text-gray-600 underline dark:text-gray-400">
        ← All chains
      </Link>

      <ChainHeader chain={chain} stepCount={steps.length} captionCount={totalCaptions} />

      <StepsEditor chainId={id} steps={steps} options={options} />

      <RunPanel chainId={id} steps={runSteps} />

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Generated media ({totalCaptions.toLocaleString("en-US")})</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Captions written with this chain, with the image each one is for. Captions saved from the run panel above are
          tagged &quot;Generated here&quot;.
        </p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {captions.map((c) => {
            const url = c.image_id ? imageUrls.get(c.image_id) : undefined;
            return (
              <li
                key={c.id}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
              >
                {url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" loading="lazy" className="h-48 w-full object-cover" />
                )}
                <div className="space-y-2 p-3">
                  {c.metadata?.tool === "the-humor-chains" && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900 dark:text-purple-200">
                      Generated here
                    </span>
                  )}
                  <p className="text-sm">{c.content}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {c.created_datetime_utc.slice(0, 10)} · {(c.like_count ?? 0).toLocaleString("en-US")} likes ·{" "}
                    {c.is_public ? "public" : "private"}
                  </p>
                </div>
              </li>
            );
          })}
          {captions.length === 0 && (
            <li className="text-sm text-gray-500 dark:text-gray-400">
              No captions yet. Run the chain on an image and save the result.
            </li>
          )}
        </ul>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Page {page}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/chains/${id}?mpage=${page - 1}`} className="rounded border border-gray-300 px-3 py-1 dark:border-gray-700">
                Previous
              </Link>
            )}
            {captions.length === MEDIA_PAGE_SIZE && (
              <Link href={`/chains/${id}?mpage=${page + 1}`} className="rounded border border-gray-300 px-3 py-1 dark:border-gray-700">
                Next
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
