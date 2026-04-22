import { cookies } from "next/headers";
import Link from "next/link";
import { cookieIsValid, ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const value = store.get(ADMIN_COOKIE_NAME)?.value;
  const authed = cookieIsValid(value);

  // Allow /admin/login to render unauthed. We can't detect the path reliably in
  // a server layout, so the login page itself simply works either way — the guard
  // only redirects on the dashboard page.
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {authed && (
        <div className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 text-sm">
            <div className="flex items-center gap-5">
              <Link href="/admin" className="font-bold">Admin</Link>
              <Link href="/admin?tab=leads" className="text-zinc-400 hover:text-white">Leads</Link>
              <Link href="/admin?tab=applications" className="text-zinc-400 hover:text-white">Applications</Link>
              <Link href="/admin?tab=sessions" className="text-zinc-400 hover:text-white">Sessions</Link>
              <Link href="/admin?tab=events" className="text-zinc-400 hover:text-white">Events</Link>
              <Link href="/admin?tab=ctas" className="text-zinc-400 hover:text-white">CTAs</Link>
              <Link href="/admin?tab=pages" className="text-zinc-400 hover:text-white">Pages</Link>
            </div>
            <form action="/api/admin/logout" method="post">
              <button className="text-zinc-400 hover:text-white" type="submit">Log out</button>
            </form>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </div>
  );
}
