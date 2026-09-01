# BingBong3000 — Personal professional site + admin page builder

Personal hire-me site for a CS → sales/solutions engineering path, with a full admin customizer for theme, pages, blocks, content, and writing.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS
- **Local JSON store** (`data/site.json`) so the site works without Supabase
- **Supabase** for production auth, Postgres persistence, and media storage (local JSON for development)
- Deploy on **Vercel** (custom domain + Analytics)

## Quick start

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Admin editor

1. Go to [http://localhost:3000/editor/login](http://localhost:3000/editor/login)
2. Local mode password: `changeme` (or `ADMIN_PASSWORD` from `.env.local`)
3. Email is only required when Supabase auth is configured
4. Edit theme / pages / blocks / writing → **Save**

Public pages: `/`, `/about`, `/work`, `/writing`, `/contact`, and `/writing/[slug]` for posts.

## Environment variables

See [`.env.local.example`](.env.local.example).

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (custom domain) for SEO/sitemap |
| `ADMIN_PASSWORD` | Local editor password when Supabase is not configured |
| `ADMIN_SESSION_SECRET` | Signs the local admin cookie |
| `ALLOW_LOCAL_ADMIN` | Set `true` only to force local admin in production (not recommended) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Required in production for saves, leads, and uploads (keep secret) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Optional Plausible analytics domain |
| `RESEND_API_KEY` / `CONTACT_TO_EMAIL` | Optional email delivery for the contact form |
| `RESEND_FROM` | Optional verified Resend From address |

Without Supabase, content persists to `data/site.json` and uploads go to `public/uploads/`.

## Supabase setup

1. Create a Supabase project
2. Run [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql) in the SQL editor
3. Optionally run [`supabase/seed.sql`](supabase/seed.sql), or Save once from the editor after connecting
4. Create auth user (Authentication → Users) — no public signup
5. Create a public Storage bucket named `site-media`
6. Fill `.env.local` and restart `npm run dev`

When Supabase env vars are present, the app reads/writes there (with local file as fallback).

## Editor capabilities

- **Theme:** colors, fonts, spacing, site name, SEO, social links
- **Pages:** create, rename, publish toggle, delete
- **Blocks:** add / remove / drag-reorder section types (hero, rich text, projects, articles, CTA, contact form, Calendly, image, stats, services)
- **Content fields:** text, links, images (upload)
- **Projects:** dedicated tab for case-study cards (feeds Work project grids)
- **Writing:** original posts and curated external articles
- **Resume:** printable CV fields with live preview
- **Calendly:** embed scheduling on Contact (set URL under Theme)
- **Live preview** in the editor

## Resume

Open [`/resume`](/resume) for a printable CV. Click **Print / Save PDF** and choose “Save as PDF” in the browser dialog (US Letter).

Edit resume content in the admin under the **Resume** tab.

## Deploy (Vercel)

See **[`DEPLOY.md`](DEPLOY.md)** for the full production checklist:

- Custom domain DNS
- Supabase required for editor saves
- SEO (`/sitemap.xml`, `/robots.txt`, Person JSON-LD)
- Vercel Analytics + Speed Insights (and optional Plausible)

Local file persistence does **not** survive on Vercel — use Supabase for production saves.

## Open questions

See [`QUESTIONS_NEEDED.md`](QUESTIONS_NEEDED.md) for deferred discovery questions (domain, brand assets, Calendly, analytics, etc.).
