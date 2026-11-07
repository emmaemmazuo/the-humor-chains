"use client";

import { useState, useTransition } from "react";
import { createStep, deleteStep, moveStep, updateStep, type StepInput } from "@/app/actions/steps";
import type { Option, Step, StepOptions } from "@/lib/types";

const box =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900";
const labelOf = (list: Option[], id: number) => list.find((o) => o.id === id)?.label ?? `#${id}`;

function StepForm({
  chainId,
  step,
  options,
  onDone,
}: {
  chainId: number;
  step?: Step;
  options: StepOptions;
  onDone: () => void;
}) {
  const defaultModel =
    options.models.find((m) => m.label.startsWith("Gemini 3.5 Flash"))?.id ?? options.models[0]?.id ?? 0;
  const defaultInput = options.inputTypes.find((o) => o.label === "text-only")?.id ?? options.inputTypes[0]?.id ?? 0;
  const defaultOutput = options.outputTypes.find((o) => o.label === "string")?.id ?? options.outputTypes[0]?.id ?? 0;
  const defaultType = options.stepTypes.find((o) => o.label === "general")?.id ?? options.stepTypes[0]?.id ?? 0;

  const [description, setDescription] = useState(step?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(step?.llm_system_prompt ?? "");
  const [userPrompt, setUserPrompt] = useState(step?.llm_user_prompt ?? "");
  const [temperature, setTemperature] = useState(step?.llm_temperature === null || step?.llm_temperature === undefined ? "" : String(step.llm_temperature));
  const [modelId, setModelId] = useState(step?.llm_model_id ?? defaultModel);
  const [inputTypeId, setInputTypeId] = useState(step?.llm_input_type_id ?? defaultInput);
  const [outputTypeId, setOutputTypeId] = useState(step?.llm_output_type_id ?? defaultOutput);
  const [stepTypeId, setStepTypeId] = useState(step?.humor_flavor_step_type_id ?? defaultType);
  const [isHidden, setIsHidden] = useState(step?.is_hidden ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    const input: StepInput = {
      description,
      systemPrompt,
      userPrompt,
      temperature,
      modelId,
      inputTypeId,
      outputTypeId,
      stepTypeId,
      isHidden,
    };
    start(async () => {
      const result = step ? await updateStep(step.id, input) : await createStep(chainId, input);
      if (result.error) setError(result.error);
      else onDone();
    });
  };

  const select = (
    label: string,
    value: number,
    set: (n: number) => void,
    list: Option[],
    hintFor?: (o: Option) => string | undefined
  ) => (
    <label className="block text-sm">
      <span className="mb-1 block text-gray-600 dark:text-gray-400">{label}</span>
      <select className={box} value={value} onChange={(e) => set(Number(e.target.value))}>
        {list.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
            {hintFor?.(o) ? ` — ${hintFor(o)}` : ""}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-gray-600 dark:text-gray-400">Description</span>
        <input className={box} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {select("Step type", stepTypeId, setStepTypeId, options.stepTypes)}
        {select("Model", modelId, setModelId, options.models)}
        {select("Input", inputTypeId, setInputTypeId, options.inputTypes)}
        {select("Output", outputTypeId, setOutputTypeId, options.outputTypes)}
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-gray-600 dark:text-gray-400">System prompt</span>
        <textarea className={`${box} font-mono`} rows={4} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-gray-600 dark:text-gray-400">
          {"User prompt (use ${step1Output} to insert the output of step 1, ${step2Output} for step 2, and so on)"}
        </span>
        <textarea className={`${box} font-mono`} rows={6} value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600 dark:text-gray-400">Temperature (0 to 2, optional)</span>
          <input className={box} value={temperature} onChange={(e) => setTemperature(e.target.value)} inputMode="decimal" />
        </label>
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" checked={isHidden} onChange={(e) => setIsHidden(e.target.checked)} />
          Hidden (skipped when running)
        </label>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
        >
          {pending ? "Saving…" : step ? "Save step" : "Add step"}
        </button>
        <button onClick={onDone} className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function StepsEditor({ chainId, steps, options }: { chainId: number; steps: Step[]; options: StepOptions }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<{ error?: string }>) => {
    setError(null);
    start(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  };

  const card = "rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900";
  const small = "rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Steps ({steps.length})</h2>
        {editing !== "new" && (
          <button
            onClick={() => setEditing("new")}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white dark:bg-gray-100 dark:text-gray-900"
          >
            + Add step
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ol className="space-y-3">
        {steps.map((s, index) => (
          <li key={s.id} className={`${card} ${s.is_hidden ? "opacity-60" : ""}`}>
            {editing === s.id ? (
              <StepForm chainId={chainId} step={s} options={options} onDone={() => setEditing(null)} />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      <span className="mr-2 rounded bg-gray-900 px-2 py-0.5 text-xs text-white dark:bg-gray-100 dark:text-gray-900">
                        Step {index + 1}
                      </span>
                      {labelOf(options.stepTypes, s.humor_flavor_step_type_id)}
                      {s.is_hidden && <span className="ml-2 text-xs text-gray-500">(hidden)</span>}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {labelOf(options.models, s.llm_model_id)} · {labelOf(options.inputTypes, s.llm_input_type_id)} →{" "}
                      {labelOf(options.outputTypes, s.llm_output_type_id)} · temperature{" "}
                      {s.llm_temperature === null ? "default" : s.llm_temperature}
                    </p>
                    {s.description && <p className="mt-2 text-sm">{s.description}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className={small} disabled={pending || index === 0} onClick={() => act(() => moveStep(s.id, "up"))}>
                      ↑ Up
                    </button>
                    <button
                      className={small}
                      disabled={pending || index === steps.length - 1}
                      onClick={() => act(() => moveStep(s.id, "down"))}
                    >
                      ↓ Down
                    </button>
                    <button className={small} onClick={() => setEditing(s.id)}>
                      Edit
                    </button>
                    <button
                      className={`${small} text-red-600 dark:text-red-400`}
                      disabled={pending}
                      onClick={() => {
                        if (confirm(`Delete step ${index + 1}? This cannot be undone.`)) act(() => deleteStep(s.id));
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-gray-600 dark:text-gray-400">Show prompts</summary>
                  <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">System</p>
                  <pre className="whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs dark:bg-gray-800">{s.llm_system_prompt || "—"}</pre>
                  <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">User</p>
                  <pre className="whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs dark:bg-gray-800">{s.llm_user_prompt || "—"}</pre>
                </details>
              </>
            )}
          </li>
        ))}
        {steps.length === 0 && editing !== "new" && (
          <li className="text-sm text-gray-500 dark:text-gray-400">No steps yet. Add the first one.</li>
        )}
        {editing === "new" && (
          <li className={card}>
            <StepForm chainId={chainId} options={options} onDone={() => setEditing(null)} />
          </li>
        )}
      </ol>
    </section>
  );
}
