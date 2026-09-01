"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Block, Page, SiteData } from "@/lib/content/types";
import { ThemePanel } from "./ThemePanel";
import { PagesPanel } from "./PagesPanel";
import { BlocksPanel } from "./BlocksPanel";
import { BlockEditor } from "./BlockEditor";
import { LivePreview } from "./LivePreview";
import { PostsPanel } from "./PostsPanel";
import { ProjectsPanel } from "./ProjectsPanel";
import { ResumePanel } from "./ResumePanel";
import { ResumeDocument } from "@/components/resume/ResumeDocument";
import { ProjectGridBlockView } from "@/components/blocks/ProjectGridBlock";

type Tab = "theme" | "pages" | "blocks" | "posts" | "projects" | "resume";

export function EditorApp() {
  const router = useRouter();
  const [data, setData] = useState<SiteData | null>(null);
  const [tab, setTab] = useState<Tab>("blocks");
  const [pageId, setPageId] = useState<string | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/site")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load site data");
        return r.json() as Promise<SiteData>;
      })
      .then((d) => {
        setData(d);
        setPageId(d.pages[0]?.id ?? null);
      })
      .catch(() => setError("Failed to load site data"));
  }, []);

  const page = useMemo(
    () => data?.pages.find((p) => p.id === pageId) ?? null,
    [data, pageId],
  );

  const selectedBlock = useMemo(
    () => page?.blocks.find((b) => b.id === blockId) ?? null,
    [page, blockId],
  );

  const updateData = useCallback((updater: (prev: SiteData) => SiteData) => {
    setData((prev) => (prev ? updater(structuredClone(prev)) : prev));
  }, []);

  async function save() {
    if (!data) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save failed");
      }
      const saved = (await res.json()) as SiteData;
      setData(saved);
      setMessage("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/editor/login");
    router.refresh();
  }

  function updatePage(next: Page) {
    updateData((d) => ({
      ...d,
      pages: d.pages.map((p) => (p.id === next.id ? next : p)),
    }));
  }

  function updateBlock(next: Block) {
    if (!page) return;
    updatePage({
      ...page,
      blocks: page.blocks.map((b) => (b.id === next.id ? next : b)),
    });
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-400">
        {error || "Loading editor…"}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold tracking-wide uppercase text-zinc-300">
            Editor
          </h1>
          <div className="flex gap-1 text-sm">
            {(
              [
                ["theme", "Theme"],
                ["pages", "Pages"],
                ["blocks", "Blocks"],
                ["projects", "Projects"],
                ["posts", "Writing"],
                ["resume", "Resume"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`px-3 py-1.5 ${
                  tab === id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {message ? <span className="text-sm text-emerald-400">{message}</span> : null}
          {error ? <span className="text-sm text-red-400">{error}</span> : null}
          <a href="/" target="_blank" className="text-sm text-zinc-400 hover:text-white">
            View site
          </a>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-emerald-400 px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={logout}
            className="text-sm text-zinc-400 hover:text-white"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[360px_1fr]">
        <aside className="max-h-[calc(100vh-53px)] overflow-y-auto border-r border-zinc-800 p-4">
          {tab === "theme" ? (
            <ThemePanel
              settings={data.settings}
              onChange={(settings) => updateData((d) => ({ ...d, settings }))}
            />
          ) : null}
          {tab === "pages" ? (
            <PagesPanel
              pages={data.pages}
              selectedId={pageId}
              onSelect={(id) => {
                setPageId(id);
                setBlockId(null);
                setTab("blocks");
              }}
              onChange={(pages) => updateData((d) => ({ ...d, pages }))}
            />
          ) : null}
          {tab === "blocks" && page ? (
            <div className="space-y-6">
              <BlocksPanel
                page={page}
                selectedBlockId={blockId}
                onSelectBlock={setBlockId}
                onChangePage={updatePage}
              />
              {selectedBlock ? (
                <BlockEditor block={selectedBlock} onChange={updateBlock} />
              ) : (
                <p className="text-sm text-zinc-500">Select a block to edit its fields.</p>
              )}
            </div>
          ) : null}
          {tab === "blocks" && !page ? (
            <p className="text-sm text-zinc-500">Create or select a page first.</p>
          ) : null}
          {tab === "posts" ? (
            <PostsPanel
              posts={data.posts}
              onChange={(posts) => updateData((d) => ({ ...d, posts }))}
            />
          ) : null}
          {tab === "projects" ? (
            <ProjectsPanel
              projects={data.projects}
              onChange={(projects) => updateData((d) => ({ ...d, projects }))}
            />
          ) : null}
          {tab === "resume" ? (
            <ResumePanel
              resume={data.resume}
              onChange={(resume) => updateData((d) => ({ ...d, resume }))}
            />
          ) : null}
        </aside>

        {tab === "resume" ? (
          <div className="max-h-[calc(100vh-53px)] overflow-y-auto bg-zinc-950 p-4">
            <div className="mx-auto max-w-[8.5in] scale-[0.92] origin-top">
              <ResumeDocument resume={data.resume} />
            </div>
          </div>
        ) : tab === "projects" ? (
          <div className="max-h-[calc(100vh-53px)] overflow-y-auto bg-zinc-950 p-4">
            <div
              className="overflow-hidden border border-zinc-800"
              style={{
                background: data.settings.theme.colors.background,
                color: data.settings.theme.colors.foreground,
                ["--color-bg" as string]: data.settings.theme.colors.background,
                ["--color-fg" as string]: data.settings.theme.colors.foreground,
                ["--color-muted" as string]: data.settings.theme.colors.muted,
                ["--color-accent" as string]: data.settings.theme.colors.accent,
                ["--color-surface" as string]: data.settings.theme.colors.surface,
                ["--color-border" as string]: data.settings.theme.colors.border,
              }}
            >
              <ProjectGridBlockView
                block={{
                  id: "preview-grid",
                  type: "projectGrid",
                  heading: "Selected work",
                  intro: "Live preview of published projects",
                  useSiteProjects: true,
                  projects: [],
                }}
                siteProjects={data.projects}
              />
            </div>
          </div>
        ) : (
          <LivePreview data={data} page={page} />
        )}
      </div>
    </div>
  );
}
