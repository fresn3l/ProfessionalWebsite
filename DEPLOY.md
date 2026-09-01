# Production setup

This guide covers custom domain, Supabase-backed editing, SEO endpoints, and analytics.

## 1. Deploy to Vercel

1. Push the repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Set environment variables (see below)
4. Deploy

## 2. Custom domain (not `*.vercel.app`)

1. In Vercel → Project → **Settings → Domains**
2. Add your domain (e.g. `yourname.com` and `www.yourname.com`)
3. Follow Vercel’s DNS instructions at your registrar:
   - Apex (`@`): A/ALIAS record Vercel provides
   - `www`: CNAME to `cname.vercel-dns.com` (or current Vercel target)
4. Wait for SSL to provision (automatic)
5. Set `NEXT_PUBLIC_SITE_URL=https://yourdomain.com` in Vercel env and redeploy

Sitemap, canonical URLs, Open Graph, and robots.txt all use `NEXT_PUBLIC_SITE_URL`.

## 3. Supabase in production (required for the editor)

Local JSON saves do **not** persist on Vercel. Production editing requires Supabase.

1. Create a Supabase project
2. Run [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql) in the SQL editor
3. Create **one** admin user under Authentication → Users (disable public signup)
4. Create a public Storage bucket named `site-media`
5. In Vercel, set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose to the client)
6. Redeploy
7. Sign in at `/editor/login` with the Supabase admin email + password
8. Click **Save** once to seed remote content from the editor (or run [`supabase/seed.sql`](supabase/seed.sql) and then edit)

Production behavior:
- Local password admin is **disabled** unless `ALLOW_LOCAL_ADMIN=true`
- Saves, contact storage, and media uploads fail clearly if Supabase or `SUPABASE_SERVICE_ROLE_KEY` is missing
- Local disk fallbacks (`data/site.json`, `public/uploads/`) are **not** used in production

## 4. SEO (shipped in the app)

After deploy with `NEXT_PUBLIC_SITE_URL`:

| URL | Purpose |
| --- | --- |
| `/sitemap.xml` | Page + writing URLs |
| `/robots.txt` | Allows public pages; blocks `/editor` and `/api` |
| Person JSON-LD | Embedded on every page for Google rich results |
| Per-page metadata | Unique title/description + Open Graph |

Submit `https://yourdomain.com/sitemap.xml` in Google Search Console when ready.

## 5. Analytics

**Vercel Analytics + Speed Insights** are included by default.

1. In Vercel → Project → **Analytics** → Enable
2. Optionally enable **Speed Insights**

**Custom engagement events** (visible under Analytics → Events after enable):

| Event | When |
| --- | --- |
| `Hire Me Click` | Header/footer/hero/CTA hire buttons |
| `Contact Submit` | Successful contact form send |
| `Contact Submit Error` | Failed contact send |
| `Resume Print` | Print / Save PDF on `/resume` |
| `Calendly View` | Visitor opened the Calendly embed |
| `Calendly Booked` | Visitor scheduled an event |
| `Scroll Depth` | 25 / 50 / 75 / 100% scrolled (`percent`, `path`) |
| `Time On Page` | 15s / 30s / 60s / 120s + final on leave (`seconds`, `path`) |

**Optional Plausible:** set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=yourdomain.com` and add the domain in Plausible (same event names are forwarded).

## 6. Recommended Vercel env checklist

```
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_SESSION_SECRET=<long random string>
RESEND_API_KEY=...          # optional
CONTACT_TO_EMAIL=...        # optional
RESEND_FROM=Portfolio Contact <hello@yourdomain.com>  # optional; must be a verified Resend sender
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=yourdomain.com  # optional
```

Do **not** set `ALLOW_LOCAL_ADMIN=true` in production unless you have a deliberate reason.

`SUPABASE_SERVICE_ROLE_KEY` is required for production editor saves, contact-lead inserts, and media uploads. Missing it returns a clear error instead of falling back to the anon key or the local filesystem.

Contact form rate limiting is in-memory (5 submissions per IP per 15 minutes **per serverless instance**). Admin-only `GET /api/leads` lists stored inquiries; they are never included in `GET`/`PUT /api/site`.
