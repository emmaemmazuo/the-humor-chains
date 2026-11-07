"use client";

import { useEffect, useState } from "react";
import { runStep, saveCaptions, searchImages, type RunStepResult } from "@/app/actions/run";
import { parseCaptions } from "@/lib/captions";
import type { ImageChoice, RunStepInfo } from "@/lib/types";

type StepResult = { stepId: number; output: string; modelUsed: string; note: string | null };

export function RunPanel({ chainId, steps }: { chainId: number; steps: RunStepInfo[] }) {
  const [query, setQuery] = useState("");
  const [images, setImages] = useState<ImageChoice[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [selected, setSelected] = useState<ImageChoice | null>(null);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const [results, setResults] = useState<StepResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    searchImages("")
      .then((r) => {
        if (!cancelled) setImages(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const search = async () => {
    setLoadingImages(true);
    try {
      setImages(await searchImages(query));
    } catch {
      setError("Could not load images.");
    } finally {
      setLoadingImages(false);
    }
  };

  const run = async () => {
    if (!selected || steps.length === 0) return;
    setRunning(true);
    setError(null);
    setSaved(null);
    setResults([]);
    const outputs: string[] = [];
    const collected: StepResult[] = [];
    for (let i = 0; i < steps.length; i++) {
      setCurrent(i);
      let r: RunStepResult;
      try {
        r = await runStep(chainId, steps[i].id, selected.id, outputs);
      } catch {
        setError(`Step ${i + 1}: the request failed or timed out.`);
        break;
      }
      if (!r.success) {
        setError(`Step ${i + 1}: ${r.error}`);
        break;
      }
      outputs.push(r.output);
      collected.push({ stepId: steps[i].id, output: r.output, modelUsed: r.modelUsed, note: r.note });
      setResults([...collected]);
    }
    setCurrent(null);
    setRunning(false);
  };

  const complete = steps.length > 0 && results.length === steps.length;
  const captions = complete
    ? parseCaptions(results[results.length - 1].output, steps[steps.length - 1].outputTypeId === 2)
    : [];

  const save = async () => {
    if (!selected || captions.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const r = await saveCaptions(chainId, selected.id, captions, results[results.length - 1]?.modelUsed ?? null);
      if (!r.success) setError(r.error);
      else setSaved(`Saved ${r.saved} caption${r.saved === 1 ? "" : "s"}. They now appear under Generated media below.`);
    } catch {
      setError("Saving failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const panel = "rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900";

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">Run this chain</h2>
      <div className={`${panel} space-y-4`}>
        {steps.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Add at least one visible step to run this chain.</p>
        ) : (
          <>
            <div>
              <p className="mb-2 text-sm font-medium">1. Pick an image</p>
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="Search image descriptions…"
                  className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
                <button
                  onClick={search}
                  disabled={loadingImages}
                  className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
                >
                  {loadingImages ? "…" : "Search"}
                </button>
              </div>
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {images.map((img) => (
                  <li key={img.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(img)}
                      title={img.description ?? ""}
                      className={`block w-full overflow-hidden rounded border-2 ${
                        selected?.id === img.id ? "border-blue-500" : "border-transparent"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" loading="lazy" className="h-24 w-full object-cover" />
                    </button>
                  </li>
                ))}
                {images.length === 0 && !loadingImages && (
                  <li className="col-span-full text-sm text-gray-500 dark:text-gray-400">No images found.</li>
                )}
              </ul>
              {selected && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Selected: {selected.description ? selected.description.slice(0, 140) : selected.id}
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">2. Run</p>
              <button
                onClick={run}
                disabled={!selected || running}
                className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
              >
                {running ? `Running step ${(current ?? 0) + 1} of ${steps.length}…` : `Run ${steps.length} step${steps.length === 1 ? "" : "s"}`}
              </button>
              {!selected && <span className="ml-3 text-xs text-gray-500">Pick an image first.</span>}
            </div>
          </>
        )}

        {steps.length > 0 && steps[0].inputTypeId !== 1 && (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            Step 1 is set to &quot;text-only&quot;, so the image you pick will not be sent to the model. Edit step 1 and set its Input to &quot;image-and-text&quot; so it can see the image.
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {results.length > 0 && (
          <ol className="space-y-3">
            {results.map((r, i) => (
              <li key={r.stepId} className="rounded border border-gray-200 p-3 dark:border-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Step {i + 1} output · {r.modelUsed}
                </p>
                {r.note && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{r.note}</p>}
                <pre className="mt-2 whitespace-pre-wrap text-sm">{r.output}</pre>
              </li>
            ))}
          </ol>
        )}

        {complete && (
          <div className="rounded border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-sm font-medium">
              {captions.length} caption{captions.length === 1 ? "" : "s"} ready
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {captions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <button
              onClick={save}
              disabled={saving || captions.length === 0 || saved !== null}
              className="mt-3 rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
            >
              {saving ? "Saving…" : saved ? "Saved" : "Save captions to this chain"}
            </button>
            {saved && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{saved}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
