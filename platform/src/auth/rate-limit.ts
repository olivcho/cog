import { createHash } from "node:crypto";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface AttemptWindow {
  attempts: number[];
}

export class LoginRateLimiter {
  private readonly windows = new Map<string, AttemptWindow>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;

  constructor(options?: {
    maxAttempts?: number;
    windowMs?: number;
    maxKeys?: number;
  }) {
    this.maxAttempts = options?.maxAttempts ?? 10;
    this.windowMs = options?.windowMs ?? 15 * 60 * 1000;
    this.maxKeys = options?.maxKeys ?? 10_000;
  }

  private normalizeKey(rawKey: string): string {
    return createHash("sha256").update(rawKey).digest("hex");
  }

  /**
   * Atomically checks capacity and reserves an attempt slot before async
   * credential verification so concurrent in-flight requests cannot exceed the limit.
   */
  consume(rawKey: string, now: number = Date.now()): RateLimitResult {
    const key = this.normalizeKey(rawKey);
    const existing = this.pruneKey(key, now);

    if (!existing && this.windows.size >= this.maxKeys) {
      this.pruneAllExpired(now);
      if (this.windows.size >= this.maxKeys) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil(this.windowMs / 1000)),
        };
      }
    }

    if (existing && existing.attempts.length >= this.maxAttempts) {
      const releaseIndex = existing.attempts.length - this.maxAttempts;
      const releaseAt = (existing.attempts[releaseIndex] ?? now) + this.windowMs;
      const retryAfterMs = Math.max(1000, releaseAt - now);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    const window = existing ?? { attempts: [] };
    window.attempts.push(now);
    this.windows.set(key, window);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  release(rawKey: string): void {
    const key = this.normalizeKey(rawKey);
    const existing = this.windows.get(key);
    if (!existing) return;
    existing.attempts.pop();
    if (existing.attempts.length === 0) {
      this.windows.delete(key);
    }
  }

  reset(rawKey: string): void {
    this.windows.delete(this.normalizeKey(rawKey));
  }

  private pruneKey(key: string, now: number): AttemptWindow | undefined {
    const existing = this.windows.get(key);
    if (!existing) return undefined;
    const cutoff = now - this.windowMs;
    const recent = existing.attempts.filter((ts) => ts > cutoff);
    if (recent.length === 0) {
      this.windows.delete(key);
      return undefined;
    }
    existing.attempts = recent;
    return existing;
  }

  private pruneAllExpired(now: number): void {
    const cutoff = now - this.windowMs;
    for (const [k, v] of this.windows) {
      const recent = v.attempts.filter((ts) => ts > cutoff);
      if (recent.length === 0) {
        this.windows.delete(k);
      } else {
        v.attempts = recent;
      }
    }
  }
}
