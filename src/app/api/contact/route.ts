import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "thenycexterminator@gmail.com";
const FROM_EMAIL = process.env.FROM_EMAIL || "hello@thenycexterminator.com";

type LeadPayload = {
  form_type: "service-quote" | "general-inquiry" | "job-application";
  name: string;
  email: string;
  phone?: string;
  message?: string;
  meta: Record<string, unknown>;
  session_id?: string | null;
  path?: string | null;
  user_agent?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value: string | undefined | null) {
  return `<tr>
    <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb; vertical-align: top;">${label}</td>
    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${value || "Not provided"}</td>
  </tr>`;
}

function buildEmail(p: LeadPayload, body: Record<string, unknown>): { subject: string; html: string } {
  if (p.form_type === "job-application") {
    const { position, experience, license, availability, location } = body as Record<string, string | undefined>;
    return {
      subject: `Job Application: ${position || "General"} - ${p.name} ${location ? `in ${location}` : ""}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #16a34a;">Job Application - TheNYCExterminator.com</h2>
          <table style="width: 100%; border-collapse: collapse;">
            ${row("Name", p.name)}
            ${row("Email", `<a href="mailto:${p.email}">${p.email}</a>`)}
            ${row("Phone", p.phone)}
            ${row("Position", position)}
            ${row("Experience", experience)}
            ${row("License", license)}
            ${row("Availability", availability)}
            ${row("Location", location)}
            ${row("About Themselves", p.message)}
          </table>
          <p style="margin-top: 16px; color: #6b7280; font-size: 14px;">
            From <a href="https://www.thenycexterminator.com">TheNYCExterminator.com</a> &mdash; Job Application Form
          </p>
        </div>
      `,
    };
  }

  if (p.form_type === "general-inquiry") {
    const { subject } = body as Record<string, string | undefined>;
    return {
      subject: `General Inquiry: ${subject || "No subject"} - ${p.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #16a34a;">General Inquiry - TheNYCExterminator.com</h2>
          <table style="width: 100%; border-collapse: collapse;">
            ${row("Name", p.name)}
            ${row("Email", `<a href="mailto:${p.email}">${p.email}</a>`)}
            ${row("Phone", p.phone)}
            ${row("Subject", subject)}
            ${row("Message", p.message)}
          </table>
          <p style="margin-top: 16px; color: #6b7280; font-size: 14px;">
            From <a href="https://www.thenycexterminator.com">TheNYCExterminator.com</a> &mdash; General Contact Form
          </p>
        </div>
      `,
    };
  }

  const { pestType, propertyType, location, urgency } = body as Record<string, string | undefined>;
  return {
    subject: `Quote Request: ${pestType || "General"} - ${p.name} ${location ? `in ${location}` : ""}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #16a34a;">Quote Request - TheNYCExterminator.com</h2>
        <table style="width: 100%; border-collapse: collapse;">
          ${row("Name", p.name)}
          ${row("Email", `<a href="mailto:${p.email}">${p.email}</a>`)}
          ${row("Phone", p.phone)}
          ${row("Pest Type", pestType)}
          ${row("Property Type", propertyType)}
          ${row("Location", location)}
          ${row("Urgency", urgency)}
          ${row("Details", p.message)}
        </table>
        <p style="margin-top: 16px; color: #6b7280; font-size: 14px;">
          From <a href="https://www.thenycexterminator.com">TheNYCExterminator.com</a> &mdash; Quote Request Form
        </p>
      </div>
    `,
  };
}

// Bulletproof persist: retries once, falls back to failed_leads on error,
// returns { ok, error } so the caller can react. NEVER throws.
async function persistLead(payload: LeadPayload, rawBody: Record<string, unknown>): Promise<{ ok: boolean; error: string | null }> {
  const supa = getSupabaseAdmin();
  if (!supa) return { ok: false, error: "supabase-client-not-configured" };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await supa.from("leads").insert({
        form_type: payload.form_type,
        name: payload.name,
        email: payload.email,
        phone: payload.phone || null,
        message: payload.message || null,
        meta: payload.meta,
        session_id: payload.session_id || null,
        path: payload.path || null,
        user_agent: payload.user_agent || null,
      });
      if (!error) return { ok: true, error: null };
      // Last attempt: bail with error message and let caller trigger fallback
      if (attempt === 1) {
        const errMsg = `${error.code || ""}:${error.message || ""}:${error.details || ""}`;
        // Best-effort write to failed_leads — also non-throwing
        try {
          await supa.from("failed_leads").insert({
            raw_payload: { ...rawBody, _path: payload.path, _user_agent: payload.user_agent },
            error_message: errMsg,
          });
        } catch (backupErr) {
          console.error("LEAD_BACKUP_INSERT_FAILED", backupErr);
        }
        console.error("LEAD_DB_INSERT_FAILED", errMsg);
        return { ok: false, error: errMsg };
      }
    } catch (err) {
      if (attempt === 1) {
        const errMsg = err instanceof Error ? err.message : String(err);
        try {
          await supa.from("failed_leads").insert({
            raw_payload: { ...rawBody, _path: payload.path, _user_agent: payload.user_agent },
            error_message: errMsg,
          });
        } catch (backupErr) {
          console.error("LEAD_BACKUP_INSERT_FAILED", backupErr);
        }
        console.error("LEAD_DB_INSERT_THREW", errMsg);
        return { ok: false, error: errMsg };
      }
    }
  }
  return { ok: false, error: "unknown" };
}

async function sendEmail(opts: { subject: string; html: string }): Promise<{ ok: boolean; error: string | null }> {
  try {
    const resp = await getResend().emails.send({
      from: `The NYC Exterminator <${FROM_EMAIL}>`,
      to: NOTIFY_EMAIL,
      subject: opts.subject,
      html: opts.html,
    });
    if (resp.error) {
      console.error("RESEND_ERROR", resp.error);
      return { ok: false, error: String(resp.error.message || resp.error) };
    }
    return { ok: true, error: null };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("RESEND_THREW", errMsg);
    return { ok: false, error: errMsg };
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name as string | undefined;
  const email = body.email as string | undefined;
  const message = body.message as string | undefined;
  const phone = body.phone as string | undefined;
  const formType = body.formType as string | undefined;
  const session_id = body.session_id as string | undefined;
  const path = req.headers.get("referer");
  const userAgent = req.headers.get("user-agent");

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Required fields missing." }, { status: 400 });
  }

  let form_type: LeadPayload["form_type"] = "service-quote";
  let meta: Record<string, unknown> = {};
  if (formType === "job-application") {
    form_type = "job-application";
    meta = {
      position: body.position,
      experience: body.experience,
      license: body.license,
      availability: body.availability,
      location: body.location,
    };
  } else if (formType === "general-inquiry") {
    form_type = "general-inquiry";
    meta = { subject: body.subject };
  } else {
    form_type = "service-quote";
    meta = {
      pestType: body.pestType,
      propertyType: body.propertyType,
      location: body.location,
      urgency: body.urgency,
    };
  }

  const payload: LeadPayload = {
    form_type,
    name,
    email,
    phone,
    message,
    meta,
    session_id,
    path,
    user_agent: userAgent,
  };

  const { subject, html } = buildEmail(payload, body);

  // Primary path: notification email. This is the ground truth — Jeff must always see the lead.
  // Run email and DB write in parallel so a slow DB never delays notification.
  const [emailResult, dbResult] = await Promise.all([
    sendEmail({ subject, html }),
    persistLead(payload, body),
  ]);

  // If DB write failed, send a SECOND email with full payload + error so Jeff can manually recover.
  if (!dbResult.ok) {
    const dump = JSON.stringify({ payload, raw_body: body, error: dbResult.error }, null, 2);
    await sendEmail({
      subject: `LEAD DB FAILURE: ${name} (${form_type}) - manual entry needed`,
      html: `
        <div style="font-family: sans-serif; max-width: 700px;">
          <h2 style="color: #dc2626;">Lead DB Write Failed</h2>
          <p>The notification email above arrived, but the Supabase write failed and the lead was queued in <code>failed_leads</code>. Add it to <code>/admin</code> manually if needed.</p>
          <p><strong>Error:</strong> <code>${escapeHtml(dbResult.error || "unknown")}</code></p>
          <pre style="background: #f3f4f6; padding: 12px; overflow: auto; font-size: 12px; line-height: 1.4;">${escapeHtml(dump)}</pre>
        </div>
      `,
    });
  }

  // Structured log line for offline lead recovery (search Vercel logs for "LEAD ").
  const safeBody = { ...body } as Record<string, unknown>;
  delete safeBody.message;
  console.log(
    `LEAD ${JSON.stringify({
      at: new Date().toISOString(),
      type: form_type,
      name,
      email,
      phone,
      db_ok: dbResult.ok,
      db_error: dbResult.error,
      email_ok: emailResult.ok,
      email_error: emailResult.error,
      meta: safeBody,
    })}`
  );

  // Return success if EITHER the email got through OR the DB row landed. We've captured the lead.
  // Only return 500 if BOTH failed — at that point there's nothing we can do server-side.
  if (emailResult.ok || dbResult.ok) {
    return NextResponse.json({ success: true });
  }

  console.error("LEAD_CAPTURE_TOTAL_FAILURE", { email: emailResult.error, db: dbResult.error });
  return NextResponse.json({ error: "Failed to send message." }, { status: 500 });
}
