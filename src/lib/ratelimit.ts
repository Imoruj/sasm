import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Upstash requires an HTTPS REST endpoint.
// When running locally with placeholder credentials, fall back to a no-op limiter.
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL ?? "";
const isUpstash = upstashUrl.startsWith("https://");

type LimitResult = { success: boolean };
interface Limiter {
  limit(identifier: string): Promise<LimitResult>;
}

function noopLimiter(): Limiter {
  return { limit: async () => ({ success: true }) };
}

function upstashLimiter(max: number, window: `${number} ${"s" | "m" | "h" | "d"}`): Limiter {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, window),
    analytics: true,
  });
}

/** 10 requests per minute for auth endpoints */
export const authLimiter: Limiter = isUpstash ? upstashLimiter(10, "1 m") : noopLimiter();

/** 100 requests per minute for applicant endpoints */
export const applicantLimiter: Limiter = isUpstash ? upstashLimiter(100, "1 m") : noopLimiter();

/** 300 requests per minute for admin endpoints */
export const adminLimiter: Limiter = isUpstash ? upstashLimiter(300, "1 m") : noopLimiter();
