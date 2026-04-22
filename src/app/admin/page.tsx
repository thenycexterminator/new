import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieIsValid, ADMIN_COOKIE_NAME } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Tab = "overview" | "leads" | "applications" | "sessions" | "events" | "ctas" | "pages";

type Lead = {
  id: string;
  form_type: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  meta: Record<string, unknown> | null;
  path: string | null;
  ts: string;
  session_id: string | null;
};

type Session = {
  id: string;
  first_seen: string;
  last_seen: string;
  landing_path: string | null;
  referrer: string | null;
  device: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string | null;
  city: string | null;
};

type EventRow = {
  id: string;
  session_id: string;
  type: string;
  name: string | null;
  path: string | null;
  meta: Record<string, unknown> | null;
  ts: string;
};

type Counted = { key: string; count: number };

function fmt(d: string): string {
  try {
    return new Date(d).toLocaleString("en-US", { timeZone: "America/New_York" });
  } catch {
    return d;
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const store = await cookies();
  if (!cookieIsValid(store.get(ADMIN_COOKIE_NAME)?.value)) {
    redirect("/admin/login");
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    return (
      <div className="rounded-xl border border-yellow-800 bg-yellow-900/20 p-6">
        <h2 className="text-lg font-bold text-yellow-300">Supabase not configured</h2>
        <p className="mt-2 text-sm text-yellow-200">
          Set <code>SUPABASE_URL</code> (or <code>NEXT_PUBLIC_SUPABASE_URL</code>) and{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> in your environment, and run{" "}
          <code>supabase/schema.sql</code> in your Supabase SQL editor.
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const tab = (params.tab as Tab) || "overview";

  if (tab === "overview") return <Overview />;
  if (tab === "leads") return <LeadsTab kind="service" />;
  if (tab === "applications") return <LeadsTab kind="application" />;
  if (tab === "sessions") return <SessionsTab />;
  if (tab === "events") return <EventsTab />;
  if (tab === "ctas") return <CtasTab />;
  if (tab === "pages") return <PagesTab />;
  return <Overview />;
}

async function Overview() {
  const supa = getSupabaseAdmin()!;
  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [leadsCount, appsCount, sessionsCount, pvCount, recentLeads] = await Promise.all([
    supa.from("leads").select("id", { count: "exact", head: true }).neq("form_type", "job-application").gte("ts", since7d),
    supa.from("leads").select("id", { count: "exact", head: true }).eq("form_type", "job-application").gte("ts", since7d),
    supa.from("sessions").select("id", { count: "exact", head: true }).gte("first_seen", since7d),
    supa.from("page_views").select("id", { count: "exact", head: true }).gte("ts", since7d),
    supa.from("leads").select("*").order("ts", { ascending: false }).limit(10),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Last 7 days</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Quote leads" value={leadsCount.count ?? 0} />
        <Stat label="Job applications" value={appsCount.count ?? 0} />
        <Stat label="Sessions" value={sessionsCount.count ?? 0} />
        <Stat label="Page views" value={pvCount.count ?? 0} />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-bold">Recent leads</h2>
        <LeadTable leads={(recentLeads.data as Lead[]) || []} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

async function LeadsTab({ kind }: { kind: "service" | "application" }) {
  const supa = getSupabaseAdmin()!;
  let q = supa.from("leads").select("*").order("ts", { ascending: false }).limit(200);
  q = kind === "application" ? q.eq("form_type", "job-application") : q.neq("form_type", "job-application");
  const { data } = await q;
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">
        {kind === "application" ? "Job applications" : "Leads"}
      </h1>
      <LeadTable leads={(data as Lead[]) || []} />
    </div>
  );
}

function LeadTable({ leads }: { leads: Lead[] }) {
  if (!leads.length) {
    return <div className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-400">No leads yet.</div>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900 text-left text-xs uppercase text-zinc-400">
          <tr>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Contact</th>
            <th className="px-3 py-2">Meta</th>
            <th className="px-3 py-2">Path</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="border-t border-zinc-800 align-top">
              <td className="px-3 py-2 text-zinc-400">{fmt(l.ts)}</td>
              <td className="px-3 py-2"><Badge>{l.form_type}</Badge></td>
              <td className="px-3 py-2 font-medium">{l.name}</td>
              <td className="px-3 py-2 text-zinc-300">
                <div>{l.email}</div>
                <div className="text-zinc-500">{l.phone}</div>
              </td>
              <td className="px-3 py-2 text-zinc-400">
                <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(l.meta, null, 2)}</pre>
                {l.message && <div className="mt-1 italic text-zinc-500">&ldquo;{l.message.slice(0, 200)}&rdquo;</div>}
              </td>
              <td className="px-3 py-2 text-zinc-500">{l.path}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200">{children}</span>;
}

async function SessionsTab() {
  const supa = getSupabaseAdmin()!;
  const { data } = await supa.from("sessions").select("*").order("first_seen", { ascending: false }).limit(200);
  const rows = (data as Session[]) || [];
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Sessions (latest 200)</h1>
      {!rows.length ? (
        <div className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-400">No sessions yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-left text-xs uppercase text-zinc-400">
              <tr>
                <th className="px-3 py-2">First seen</th>
                <th className="px-3 py-2">Landing</th>
                <th className="px-3 py-2">Referrer</th>
                <th className="px-3 py-2">UTM</th>
                <th className="px-3 py-2">Device</th>
                <th className="px-3 py-2">Location</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-zinc-800">
                  <td className="px-3 py-2 text-zinc-400">{fmt(s.first_seen)}</td>
                  <td className="px-3 py-2">{s.landing_path}</td>
                  <td className="px-3 py-2 text-zinc-400">{s.referrer || "(direct)"}</td>
                  <td className="px-3 py-2 text-zinc-400">
                    {[s.utm_source, s.utm_medium, s.utm_campaign].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-3 py-2">{s.device}</td>
                  <td className="px-3 py-2 text-zinc-400">{[s.city, s.country].filter(Boolean).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function EventsTab() {
  const supa = getSupabaseAdmin()!;
  const { data } = await supa.from("events").select("*").order("ts", { ascending: false }).limit(300);
  const rows = (data as EventRow[]) || [];
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Events (latest 300)</h1>
      {!rows.length ? (
        <div className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-400">No events yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-left text-xs uppercase text-zinc-400">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Path</th>
                <th className="px-3 py-2">Meta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-zinc-800 align-top">
                  <td className="px-3 py-2 text-zinc-400">{fmt(e.ts)}</td>
                  <td className="px-3 py-2"><Badge>{e.type}</Badge></td>
                  <td className="px-3 py-2">{e.name}</td>
                  <td className="px-3 py-2 text-zinc-400">{e.path}</td>
                  <td className="px-3 py-2 text-zinc-400">
                    <pre className="whitespace-pre-wrap text-xs">{e.meta ? JSON.stringify(e.meta) : ""}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function CtasTab() {
  const supa = getSupabaseAdmin()!;
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const [{ data: ctaRows }, { data: outRows }] = await Promise.all([
    supa.from("events").select("name, path").eq("type", "cta_click").gte("ts", since),
    supa.from("events").select("name, meta").eq("type", "outbound_click").gte("ts", since),
  ]);

  const byCta = aggregate(((ctaRows as { name: string | null }[]) || []).map((r) => r.name || "(unnamed)"));
  const byOut = aggregate(
    ((outRows as { meta: { kind?: string } | null }[]) || []).map((r) => r.meta?.kind || "unknown")
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-xl font-bold">CTA clicks (30 days)</h1>
        <CountTable rows={byCta} />
      </div>
      <div>
        <h2 className="mb-4 text-lg font-bold">Outbound clicks by kind</h2>
        <CountTable rows={byOut} />
      </div>
    </div>
  );
}

async function PagesTab() {
  const supa = getSupabaseAdmin()!;
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data } = await supa.from("page_views").select("path").gte("ts", since);
  const rows = aggregate(((data as { path: string | null }[]) || []).map((r) => r.path || "/"));

  // Scroll-depth completion rate per path
  const { data: scrollData } = await supa
    .from("events")
    .select("path, name")
    .eq("type", "scroll_depth")
    .gte("ts", since);

  const depth100 = new Map<string, number>();
  const depthAll = new Map<string, number>();
  for (const r of (scrollData as { path: string | null; name: string | null }[]) || []) {
    const p = r.path || "/";
    depthAll.set(p, (depthAll.get(p) || 0) + 1);
    if (r.name === "100") depth100.set(p, (depth100.get(p) || 0) + 1);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-xl font-bold">Page views (30 days)</h1>
        <CountTable rows={rows} />
      </div>
      <div>
        <h2 className="mb-4 text-lg font-bold">Scroll to 100% (count)</h2>
        <CountTable rows={[...depth100.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)} />
      </div>
    </div>
  );
}

function aggregate(keys: string[]): Counted[] {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) || 0) + 1);
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

function CountTable({ rows }: { rows: Counted[] }) {
  if (!rows.length) {
    return <div className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-400">No data yet.</div>;
  }
  const max = rows[0]?.count || 1;
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-zinc-800 first:border-t-0">
              <td className="w-1/2 px-3 py-2 font-mono text-xs text-zinc-300">{r.key}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 rounded bg-zinc-800">
                    <div
                      className="h-2 rounded bg-green-500"
                      style={{ width: `${(r.count / max) * 100}%` }}
                    />
                  </div>
                  <div className="w-12 text-right text-zinc-300">{r.count}</div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
