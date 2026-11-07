"use client";

import { createClient } from "@/utils/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const signIn = async () => {
    await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div>
        <h1 className="text-2xl font-bold">Prompt Chain Tool</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">Superadmins only.</p>
      </div>
      <button
        onClick={signIn}
        className="rounded-lg bg-gray-900 px-6 py-3 text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
      >
        Sign in with Google
      </button>
    </div>
  );
}
