/**
 * In-memory per-IP rate limiter.
 * Limits are per serverless instance; they are not shared across Vercel isolates.
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export function isRateLimited(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  const recent = bucket.timestamps.filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, { timestamps: recent });
    return true;
  }
  recent.push(now);
  buckets.set(key, { timestamps: recent });
  return false;
}
