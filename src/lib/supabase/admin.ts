import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function hasServiceRoleKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export const SERVICE_ROLE_REQUIRED_MESSAGE =
  "Production writes require SUPABASE_SERVICE_ROLE_KEY.";

export const PRODUCTION_SUPABASE_REQUIRED_MESSAGE =
  "Production requires Supabase. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.";

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }
  if (isProduction() && !hasServiceRoleKey()) {
    throw new Error(SERVICE_ROLE_REQUIRED_MESSAGE);
  }
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("Supabase keys are not configured");
  }
  return createClient(url, key);
}
