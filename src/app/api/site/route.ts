import { NextResponse } from "next/server";
import {
  getSiteData,
  saveSiteData,
  withoutLeads,
} from "@/lib/content/repository";
import { isAdminAuthenticated } from "@/lib/auth";
import type { SiteData } from "@/lib/content/types";

export async function GET() {
  const ok = await isAdminAuthenticated();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getSiteData();
  return NextResponse.json(withoutLeads(data));
}

export async function PUT(request: Request) {
  const ok = await isAdminAuthenticated();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as SiteData;
  if (!body?.settings || !Array.isArray(body.pages)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const saved = await saveSiteData({
      ...body,
      resume: body.resume,
      projects: body.projects ?? [],
      posts: body.posts ?? [],
      leads: [],
    });
    return NextResponse.json(withoutLeads(saved));
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 },
    );
  }
}
