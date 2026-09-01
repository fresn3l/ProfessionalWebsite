import { NextResponse } from "next/server";
import { addLead } from "@/lib/content/repository";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 200;
const MAX_EMAIL = 254;
const MAX_COMPANY = 200;
const MAX_MESSAGE = 5000;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (isRateLimited(`contact:${ip}`, { limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS })) {
    return NextResponse.json(
      { error: "Too many inquiries. Please try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const company = String(body.company || "").trim();
  const message = String(body.message || "").trim();

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Name, email, and message are required." },
      { status: 400 },
    );
  }

  if (name.length > MAX_NAME || email.length > MAX_EMAIL || company.length > MAX_COMPANY) {
    return NextResponse.json({ error: "Input is too long." }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Message must be ${MAX_MESSAGE} characters or fewer.` },
      { status: 400 },
    );
  }

  let lead;
  try {
    lead = await addLead({
      name,
      email,
      company: company || undefined,
      message,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to store inquiry" },
      { status: 500 },
    );
  }

  if (process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL) {
    try {
      const from =
        process.env.RESEND_FROM || "Portfolio Contact <onboarding@resend.dev>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [process.env.CONTACT_TO_EMAIL],
          subject: `Hire inquiry from ${name}`,
          text: `From: ${name} <${email}>\nCompany: ${company || "—"}\n\n${message}`,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error("Resend delivery failed", res.status, detail);
      }
    } catch (err) {
      console.error("Resend delivery failed", err);
    }
  }

  return NextResponse.json({ ok: true, id: lead.id });
}
