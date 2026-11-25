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

  check(key: string, now: number = Date.now()): RateLimitResult {
    const window = this.pruneKey(key, now);
    if (!window || window.attempts.length < this.maxAttempts) {
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const oldest = window.attempts[0] ?? now;
    const retryAfterMs = Math.max(1000, oldest + this.windowMs - now);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  recordFailure(key: string, now: number = Date.now()): void {
    const window = this.pruneKey(key, now) ?? { attempts: [] };
    window.attempts.push(now);
    this.windows.set(key, window);
    if (this.windows.size > this.maxKeys) {
      this.evictOldest(now);
    }
  }

  reset(key: string): void {
    this.windows.delete(key);
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

  private evictOldest(now: number): void {
    const cutoff = now - this.windowMs;
    for (const [k, v] of this.windows) {
      if (v.attempts.every((ts) => ts <= cutoff)) {
        this.windows.delete(k);
      }
      if (this.windows.size <= this.maxKeys) return;
    }
    const firstKey = this.windows.keys().next().value;
    if (firstKey !== undefined) {
      this.windows.delete(firstKey);
    }
  }
}
