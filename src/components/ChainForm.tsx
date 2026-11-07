"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createChain, updateChain } from "@/app/actions/chains";

export type Chain = {
  id: number;
  slug: string;
  description: string | null;
  is_pinned: boolean;
};

const field =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900";

export function ChainForm({
  chain,
  onDone,
  onCancel,
}: {
  chain?: Chain;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(chain?.slug ?? "");
  const [description, setDescription] = useState(chain?.description ?? "");
  const [isPinned, setIsPinned] = useState(chain?.is_pinned ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    start(async () => {
      if (chain) {
        const updated = await updateChain(chain.id, { slug, description, isPinned });
        if (updated.error) {
          setError(updated.error);
          return;
        }
        router.refresh();
        onDone?.();
        return;
      }
      const created = await createChain({ slug, description, isPinned });
      if (created.error || !created.id) {
        setError(created.error ?? "Could not create the chain.");
        return;
      }
      router.push(`/chains/${created.id}`);
    });
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-gray-600 dark:text-gray-400">Slug (the chain&apos;s name) *</span>
        <input className={field} value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={100} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-gray-600 dark:text-gray-400">Description</span>
        <textarea
          className={field}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
        Pinned
      </label>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
        >
          {pending ? "Saving…" : chain ? "Save" : "Create chain"}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
