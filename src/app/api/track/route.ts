import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import crypto from "crypto";

export const runtime = "nodejs";

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT || "nyce-default-salt";
  return crypto.createHash("sha256").update(ip + salt).digest("hex").slice(0, 32);
}

function getIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

type SessionInsert = {
  id: string;
  referrer?: string | null;
  landing_path?: string | null;
  user_agent?: string | null;
  language?: string | null;
  screen_w?: number | null;
  screen_h?: number | null;
  device?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  ip_hash?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
};

export async function POST(req: NextRequest) {
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ ok: false, reason: "no-supabase" });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  const kind = body.kind as string | undefined;
  if (!kind) return NextResponse.json({ ok: false, reason: "missing-kind" }, { status: 400 });

  const ipHash = hashIp(getIp(req));
  const country = req.headers.get("x-vercel-ip-country");
  const region = req.headers.get("x-vercel-ip-country-region");
  const city = req.headers.get("x-vercel-ip-city");

  if (kind === "session") {
    const s = body.session as SessionInsert | undefined;
    if (!s?.id) return NextResponse.json({ ok: false, reason: "missing-session-id" }, { status: 400 });
    await supa.from("sessions").upsert(
      {
        ...s,
        ip_hash: ipHash,
        country,
        region,
        city: city ? decodeURIComponent(city) : null,
      },
      { onConflict: "id" }
    );
    return NextResponse.json({ ok: true });
  }

  if (kind === "pageview") {
    const sid = body.session_id as string | undefined;
    if (!sid) return NextResponse.json({ ok: false, reason: "missing-sid" }, { status: 400 });
    // Touch last_seen
    await supa.from("sessions").update({ last_seen: new Date().toISOString() }).eq("id", sid);
    await supa.from("page_views").insert({
      session_id: sid,
      path: (body.path as string) || "/",
      title: (body.title as string) || null,
      referrer: (body.referrer as string) || null,
    });
    return NextResponse.json({ ok: true });
  }

  if (kind === "event") {
    const sid = body.session_id as string | undefined;
    if (!sid) return NextResponse.json({ ok: false, reason: "missing-sid" }, { status: 400 });
    await supa.from("sessions").update({ last_seen: new Date().toISOString() }).eq("id", sid);
    await supa.from("events").insert({
      session_id: sid,
      type: (body.type as string) || "unknown",
      name: (body.name as string) || null,
      path: (body.path as string) || null,
      meta: (body.meta as Record<string, unknown>) || null,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, reason: "unknown-kind" }, { status: 400 });
}
