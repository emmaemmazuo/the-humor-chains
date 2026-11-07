"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="text-sm text-gray-600 underline hover:text-black dark:text-gray-400 dark:hover:text-white"
    >
      Log out
    </button>
  );
}
