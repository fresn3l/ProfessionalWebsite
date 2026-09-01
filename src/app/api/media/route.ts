import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  createAdminClient,
  isProduction,
  isSupabaseConfigured,
  SERVICE_ROLE_REQUIRED_MESSAGE,
} from "@/lib/supabase/admin";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const ok = await isAdminAuthenticated();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, GIF, WebP, and SVG images are allowed." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image must be 4MB or smaller." },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;

  if (isSupabaseConfigured()) {
    try {
      const sb = createAdminClient();
      const { error } = await sb.storage.from("site-media").upload(filename, bytes, {
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const { data } = sb.storage.from("site-media").getPublicUrl(filename);
      return NextResponse.json({ url: data.publicUrl, path: filename });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : SERVICE_ROLE_REQUIRED_MESSAGE;
      if (isProduction()) {
        return NextResponse.json({ error: message }, { status: 503 });
      }
    }
  }

  if (isProduction()) {
    return NextResponse.json(
      { error: "Production uploads require Supabase Storage." },
      { status: 503 },
    );
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), bytes);
  return NextResponse.json({ url: `/uploads/${filename}`, path: filename });
}
