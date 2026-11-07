"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const options = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-8 w-[11.5rem]" aria-hidden="true" />;

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex overflow-hidden rounded-md border border-gray-300 text-sm dark:border-gray-700"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setTheme(o.value)}
          aria-pressed={theme === o.value}
          className={`px-3 py-1 ${
            theme === o.value
              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
              : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
