import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/generate-report
 *
 * Triggers the LangGraph pipeline. The Python service is deployed on a
 * separate runtime (e.g. Modal, Fly Machines, or a Vercel Python function)
 * and we call it over HTTP. This route is auth-gated and idempotent for a
 * given week — it will return the existing report if one was already
 * generated within the period.
 *
 * Cron: configured in vercel.json to run every Monday 05:00 UTC.
 */
export async function POST() {
  const { userId, orgId } = auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();

  // Idempotency: if a report exists for the current week, return it.
  const periodStart = startOfWeek(new Date());
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 6);

  const { data: existing } = await sb
    .from("reports")
    .select("id, pdf_url, pptx_url, narrative")
    .eq("org_id", orgId)
    .eq("period_start", periodStart.toISOString().slice(0, 10))
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ status: "exists", report: existing });
  }

  // Kick off the LangGraph pipeline. The Python service authenticates with
  // a shared secret + the requesting org_id. It writes the finished report
  // back to Supabase and emails stakeholders via Resend.
  const pipelineUrl = process.env.PIPELINE_URL!;
  const res = await fetch(`${pipelineUrl}/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.PIPELINE_SECRET}`,
    },
    body: JSON.stringify({
      org_id: orgId,
      period_start: periodStart.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "pipeline_failed", detail: await res.text() }, { status: 502 });
  }

  return NextResponse.json({ status: "queued", run: await res.json() });
}

function startOfWeek(d: Date) {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday-anchored
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}
