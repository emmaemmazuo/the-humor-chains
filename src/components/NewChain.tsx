"use client";

import { useState } from "react";
import { ChainForm } from "@/components/ChainForm";

export function NewChain() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-gray-900 px-4 py-2 text-sm text-white dark:bg-gray-100 dark:text-gray-900"
      >
        + New chain
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <ChainForm onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
    </div>
  );
}
