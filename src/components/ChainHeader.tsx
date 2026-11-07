"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChainForm, type Chain } from "@/components/ChainForm";
import { deleteChain } from "@/app/actions/chains";

export function ChainHeader({
  chain,
  stepCount,
  captionCount,
}: {
  chain: Chain;
  stepCount: number;
  captionCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const remove = () => {
    if (!confirm(`Delete "${chain.slug}" and its ${stepCount} step(s)? This cannot be undone.`)) return;
    setError(null);
    start(async () => {
      const result = await deleteChain(chain.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/");
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      {editing ? (
        <ChainForm chain={chain} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="break-all text-xl font-bold">
                {chain.is_pinned && <span title="Pinned">📌 </span>}
                {chain.slug}
              </h1>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Chain #{chain.id} · {stepCount} step{stepCount === 1 ? "" : "s"} · {captionCount.toLocaleString("en-US")} caption
                {captionCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <button onClick={() => setEditing(true)} className="underline">
                Edit
              </button>
              <button
                onClick={remove}
                disabled={pending}
                className="text-red-600 underline disabled:opacity-50 dark:text-red-400"
              >
                Delete
              </button>
            </div>
          </div>
          {chain.description && <p className="mt-3 whitespace-pre-wrap text-sm">{chain.description}</p>}
          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </>
      )}
    </div>
  );
}
