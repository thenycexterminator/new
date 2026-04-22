import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

// Wall-clock refresh of JobPosting pages every 7 days.
// Triggered by Vercel cron (see vercel.json). Forces ISR regeneration
// of every /areas/[neighborhood] and /careers/[slug] page so that the
// dynamic `datePosted` (today) and `validThrough` (today + 365d) get
// re-baked into the static HTML even if no human/crawler hits the page.
//
// Vercel auto-attaches `Authorization: Bearer <CRON_SECRET>` to its
// cron requests when CRON_SECRET is set in project env vars.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  revalidatePath("/areas/[neighborhood]", "page");
  revalidatePath("/careers/[slug]", "page");

  return NextResponse.json({
    revalidated: true,
    paths: ["/areas/[neighborhood]", "/careers/[slug]"],
    at: new Date().toISOString(),
  });
}
