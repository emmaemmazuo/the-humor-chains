import Link from "next/link";
import { requireSuperadmin } from "@/lib/require-superadmin";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSuperadmin();

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link href="/" className="font-bold">
            Prompt Chain Tool
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            <ThemeToggle />
            <span className="text-sm text-gray-500 dark:text-gray-400">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
