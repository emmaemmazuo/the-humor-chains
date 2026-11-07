import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function DeniedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="text-gray-600 dark:text-gray-400">{user.email} is not a superadmin.</p>
      <LogoutButton />
    </div>
  );
}
