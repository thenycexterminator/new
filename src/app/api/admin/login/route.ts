import { NextRequest, NextResponse } from "next/server";
import { checkPassword, buildAuthCookie } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as { password?: string }));
  const password = (body as { password?: string }).password || "";
  if (!checkPassword(password)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const cookie = buildAuthCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: cookie.name,
    value: cookie.value,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: cookie.maxAge,
  });
  return res;
}
