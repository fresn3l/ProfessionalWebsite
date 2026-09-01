import { promises as fs } from "fs";
import path from "path";
import { seedData } from "./seed";
import type {
  ContactLead,
  Page,
  Post,
  SiteData,
  SiteSettings,
} from "./types";
import { ensureTheme } from "@/lib/theme";
import { ensureResume } from "./resume";
import { ensureProjects } from "./projects";
import {
  createAdminClient,
  isProduction,
  isSupabaseConfigured,
  SERVICE_ROLE_REQUIRED_MESSAGE,
} from "@/lib/supabase/admin";

const DATA_PATH = path.join(process.cwd(), "data", "site.json");

function normalizeSiteData(data: SiteData): SiteData {
  const pages = data.pages || [];
  return {
    ...data,
    settings: {
      ...data.settings,
      theme: ensureTheme(data.settings.theme),
      resumeUrl: data.settings.resumeUrl || "/resume",
    },
    resume: ensureResume(data.resume),
    projects: ensureProjects(data.projects, pages),
    posts: data.posts || [],
    leads: data.leads || [],
    pages,
  };
}

function mapLead(l: {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  message: string;
  created_at: string;
}): ContactLead {
  return {
    id: l.id,
    name: l.name,
    email: l.email,
    company: l.company ?? undefined,
    message: l.message,
    createdAt: l.created_at,
  };
}

/** Editor/API payloads must never include contact leads. */
export function withoutLeads(data: SiteData): SiteData {
  return { ...data, leads: [] };
}

async function ensureLocalFile(): Promise<SiteData> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    return normalizeSiteData(JSON.parse(raw) as SiteData);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(seedData, null, 2), "utf8");
    return structuredClone(seedData);
  }
}

async function readLocalLeads(): Promise<ContactLead[]> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const existing = JSON.parse(raw) as SiteData;
    return existing.leads || [];
  } catch {
    return [];
  }
}

async function writeLocal(data: SiteData) {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function loadFromSupabase(): Promise<SiteData | null> {
  try {
    const sb = createAdminClient();
    const [{ data: settingsRow }, { data: pages }, { data: posts }] =
      await Promise.all([
        sb.from("site_settings").select("data").eq("id", 1).maybeSingle(),
        sb.from("pages").select("*").order("slug"),
        sb.from("posts").select("*").order("published_at", { ascending: false }),
      ]);

    if (!settingsRow?.data) return null;

    const raw = settingsRow.data as
      | SiteSettings
      | {
          settings: SiteSettings;
          resume?: SiteData["resume"];
          projects?: SiteData["projects"];
        };

    const settings =
      raw && typeof raw === "object" && "settings" in raw
        ? raw.settings
        : (raw as SiteSettings);
    const resume =
      raw && typeof raw === "object" && "settings" in raw
        ? raw.resume
        : undefined;
    const projects =
      raw && typeof raw === "object" && "settings" in raw
        ? raw.projects
        : undefined;

    const mappedPages = (pages || []).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      published: p.published,
      seoDescription: p.seo_description ?? undefined,
      blocks: p.blocks,
      updatedAt: p.updated_at,
    }));

    return {
      settings,
      resume: ensureResume(resume),
      projects: ensureProjects(projects, mappedPages),
      pages: mappedPages,
      posts: (posts || []).map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        summary: p.summary,
        body: p.body,
        kind: p.kind,
        externalUrl: p.external_url ?? undefined,
        source: p.source ?? undefined,
        published: p.published,
        publishedAt: p.published_at,
      })),
      leads: [],
    };
  } catch (err) {
    if (
      err instanceof Error &&
      err.message === SERVICE_ROLE_REQUIRED_MESSAGE
    ) {
      throw err;
    }
    return null;
  }
}

async function saveToSupabase(data: SiteData) {
  const sb = createAdminClient();
  const { error: settingsError } = await sb.from("site_settings").upsert({
    id: 1,
    data: {
      settings: data.settings,
      resume: data.resume,
      projects: data.projects,
    },
    updated_at: new Date().toISOString(),
  });
  if (settingsError) {
    throw new Error(settingsError.message);
  }

  for (const page of data.pages) {
    const { error } = await sb.from("pages").upsert({
      id: page.id,
      slug: page.slug,
      title: page.title,
      published: page.published,
      seo_description: page.seoDescription ?? null,
      blocks: page.blocks,
      updated_at: page.updatedAt,
    });
    if (error) throw new Error(error.message);
  }

  for (const post of data.posts) {
    const { error } = await sb.from("posts").upsert({
      id: post.id,
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      body: post.body,
      kind: post.kind,
      external_url: post.externalUrl ?? null,
      source: post.source ?? null,
      published: post.published,
      published_at: post.publishedAt,
    });
    if (error) throw new Error(error.message);
  }

  const pageIds = data.pages.map((p) => p.id);
  const { data: existingPages, error: pageListError } = await sb
    .from("pages")
    .select("id");
  if (pageListError) throw new Error(pageListError.message);
  const stalePageIds = (existingPages || [])
    .map((p) => p.id as string)
    .filter((id) => !pageIds.includes(id));
  if (stalePageIds.length > 0) {
    const { error } = await sb.from("pages").delete().in("id", stalePageIds);
    if (error) throw new Error(error.message);
  }

  const postIds = data.posts.map((p) => p.id);
  const { data: existingPosts, error: postListError } = await sb
    .from("posts")
    .select("id");
  if (postListError) throw new Error(postListError.message);
  const stalePostIds = (existingPosts || [])
    .map((p) => p.id as string)
    .filter((id) => !postIds.includes(id));
  if (stalePostIds.length > 0) {
    const { error } = await sb.from("posts").delete().in("id", stalePostIds);
    if (error) throw new Error(error.message);
  }
}

export async function getSiteData(): Promise<SiteData> {
  if (isSupabaseConfigured()) {
    const remote = await loadFromSupabase();
    if (remote) return normalizeSiteData(remote);
  }
  return ensureLocalFile();
}

export async function saveSiteData(data: SiteData): Promise<SiteData> {
  const preservedLeads = isSupabaseConfigured() ? [] : await readLocalLeads();
  const next = normalizeSiteData({
    ...data,
    leads: preservedLeads,
    pages: data.pages.map((p) => ({
      ...p,
      updatedAt: new Date().toISOString(),
    })),
  });

  const prod = isProduction();

  if (prod && !isSupabaseConfigured()) {
    throw new Error(
      "Production saves require Supabase. Set NEXT_PUBLIC_SUPABASE_URL and keys.",
    );
  }

  if (isSupabaseConfigured()) {
    await saveToSupabase(next);
    if (!prod) {
      const localLeads = await readLocalLeads();
      await writeLocal({ ...next, leads: localLeads });
    }
    return withoutLeads(next);
  }

  await writeLocal(next);
  return withoutLeads(next);
}

export async function getSettings(): Promise<SiteSettings> {
  const data = await getSiteData();
  return data.settings;
}

export async function getPages(): Promise<Page[]> {
  const data = await getSiteData();
  return data.pages.filter((p) => p.published);
}

export async function getAllPages(): Promise<Page[]> {
  const data = await getSiteData();
  return data.pages;
}

export async function getPageBySlug(slug: string): Promise<Page | null> {
  const data = await getSiteData();
  const normalized = slug === "" || slug === "/" ? "home" : slug;
  return data.pages.find((p) => p.slug === normalized && p.published) ?? null;
}

export async function getPosts(): Promise<Post[]> {
  const data = await getSiteData();
  return data.posts.filter((p) => p.published);
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const data = await getSiteData();
  return data.posts.find((p) => p.slug === slug && p.published) ?? null;
}

export async function getLeads(): Promise<ContactLead[]> {
  if (isSupabaseConfigured()) {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapLead);
  }
  const data = await ensureLocalFile();
  return data.leads || [];
}

export async function addLead(
  lead: Omit<ContactLead, "id" | "createdAt">,
): Promise<ContactLead> {
  const entry: ContactLead = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...lead,
  };

  if (isSupabaseConfigured()) {
    const sb = createAdminClient();
    const { error } = await sb.from("leads").insert({
      id: entry.id,
      name: entry.name,
      email: entry.email,
      company: entry.company ?? null,
      message: entry.message,
      created_at: entry.createdAt,
    });
    if (error) {
      throw new Error(error.message || "Failed to store lead");
    }
    if (!isProduction()) {
      try {
        const data = await ensureLocalFile();
        data.leads = [entry, ...data.leads];
        await writeLocal(data);
      } catch {
        // Local mirror is optional in development.
      }
    }
    return entry;
  }

  if (isProduction()) {
    throw new Error(
      "Production contact requires Supabase. Set NEXT_PUBLIC_SUPABASE_URL and keys.",
    );
  }

  const data = await ensureLocalFile();
  data.leads = [entry, ...data.leads];
  await writeLocal(data);
  return entry;
}

export async function getResume() {
  const data = await getSiteData();
  return data.resume;
}

export async function getProjects() {
  const data = await getSiteData();
  return data.projects.filter((p) => p.published);
}

export { isSupabaseConfigured };
