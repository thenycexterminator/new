import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "thenycexterminator@gmail.com";
const FROM_EMAIL = process.env.FROM_EMAIL || "hello@thenycexterminator.com";

async function persistLead(params: {
  form_type: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  meta: Record<string, unknown>;
  session_id?: string | null;
  path?: string | null;
  user_agent?: string | null;
}) {
  const supa = getSupabaseAdmin();
  if (!supa) return;
  try {
    await supa.from("leads").insert({
      form_type: params.form_type,
      name: params.name,
      email: params.email,
      phone: params.phone || null,
      message: params.message || null,
      meta: params.meta,
      session_id: params.session_id || null,
      path: params.path || null,
      user_agent: params.user_agent || null,
    });
  } catch (err) {
    console.error("Failed to persist lead to Supabase:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, message, formType, session_id } = body;
    const path = req.headers.get("referer") || null;
    const userAgent = req.headers.get("user-agent") || null;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Required fields missing." },
        { status: 400 }
      );
    }

    if (formType === "job-application") {
      const { position, experience, license, availability, location } = body;
      await persistLead({
        form_type: "job-application",
        name,
        email,
        phone,
        message,
        meta: { position, experience, license, availability, location },
        session_id,
        path,
        user_agent: userAgent,
      });
      await getResend().emails.send({
        from: `The NYC Exterminator <${FROM_EMAIL}>`,
        to: NOTIFY_EMAIL,
        subject: `Job Application: ${position || "General"} - ${name} ${location ? `in ${location}` : ""}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px;">
            <h2 style="color: #16a34a;">Job Application - TheNYCExterminator.com</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${row("Name", name)}
              ${row("Email", `<a href="mailto:${email}">${email}</a>`)}
              ${row("Phone", phone)}
              ${row("Position", position)}
              ${row("Experience", experience)}
              ${row("License", license)}
              ${row("Availability", availability)}
              ${row("Location", location)}
              ${row("About Themselves", message)}
            </table>
            <p style="margin-top: 16px; color: #6b7280; font-size: 14px;">
              From <a href="https://www.thenycexterminator.com">TheNYCExterminator.com</a> &mdash; Job Application Form
            </p>
          </div>
        `,
      });
    } else if (formType === "general-inquiry") {
      const { subject } = body;
      await persistLead({
        form_type: "general-inquiry",
        name,
        email,
        phone,
        message,
        meta: { subject },
        session_id,
        path,
        user_agent: userAgent,
      });
      await getResend().emails.send({
        from: `The NYC Exterminator <${FROM_EMAIL}>`,
        to: NOTIFY_EMAIL,
        subject: `General Inquiry: ${subject || "No subject"} - ${name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px;">
            <h2 style="color: #16a34a;">General Inquiry - TheNYCExterminator.com</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${row("Name", name)}
              ${row("Email", `<a href="mailto:${email}">${email}</a>`)}
              ${row("Phone", phone)}
              ${row("Subject", subject)}
              ${row("Message", message)}
            </table>
            <p style="margin-top: 16px; color: #6b7280; font-size: 14px;">
              From <a href="https://www.thenycexterminator.com">TheNYCExterminator.com</a> &mdash; General Contact Form
            </p>
          </div>
        `,
      });
    } else {
      const { pestType, propertyType, location, urgency } = body;
      await persistLead({
        form_type: "service-quote",
        name,
        email,
        phone,
        message,
        meta: { pestType, propertyType, location, urgency },
        session_id,
        path,
        user_agent: userAgent,
      });
      await getResend().emails.send({
        from: `The NYC Exterminator <${FROM_EMAIL}>`,
        to: NOTIFY_EMAIL,
        subject: `Quote Request: ${pestType || "General"} - ${name} ${location ? `in ${location}` : ""}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px;">
            <h2 style="color: #16a34a;">Quote Request - TheNYCExterminator.com</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${row("Name", name)}
              ${row("Email", `<a href="mailto:${email}">${email}</a>`)}
              ${row("Phone", phone)}
              ${row("Pest Type", pestType)}
              ${row("Property Type", propertyType)}
              ${row("Location", location)}
              ${row("Urgency", urgency)}
              ${row("Details", message)}
            </table>
            <p style="margin-top: 16px; color: #6b7280; font-size: 14px;">
              From <a href="https://www.thenycexterminator.com">TheNYCExterminator.com</a> &mdash; Quote Request Form
            </p>
          </div>
        `,
      });
    }

    // Structured log line for lead-counting via Vercel Logs (search "LEAD ").
    // Format is grep-friendly so you can pipe Vercel log exports through
    // `grep "^LEAD " | wc -l` to get a true count without needing a database.
    const safeBody = { ...body } as Record<string, unknown>;
    delete safeBody.message; // strip free-text body from logs (PII / size)
    console.log(`LEAD ${JSON.stringify({
      at: new Date().toISOString(),
      type: formType || "service-quote",
      name,
      email,
      phone,
      meta: safeBody,
    })}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send message." },
      { status: 500 }
    );
  }
}

function row(label: string, value: string | undefined) {
  return `<tr>
    <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb; vertical-align: top;">${label}</td>
    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${value || "Not provided"}</td>
  </tr>`;
}
