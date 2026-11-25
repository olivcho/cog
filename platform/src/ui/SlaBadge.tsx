"use client";

import { useEffect, useState } from "react";

const DEFAULT_URGENT_WINDOW_MS = 4 * 3600_000;

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.abs(ms) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(minutes, 1)}m`;
}

const BASE =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs tabular-nums";

export function SlaBadge({
  dueAt,
  closed = false,
  urgentWindowMs = DEFAULT_URGENT_WINDOW_MS,
}: {
  dueAt: string | Date;
  closed?: boolean;
  urgentWindowMs?: number;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (closed) {
    return (
      <span className={`${BASE} border-slate-200 bg-slate-50 font-medium text-slate-500`}>
        Closed
      </span>
    );
  }

  const diffMs = new Date(dueAt).getTime() - now;
  if (diffMs < 0) {
    return (
      <span
        suppressHydrationWarning
        className={`${BASE} border-red-200 bg-red-50 font-semibold text-red-700`}
      >
        Breached {formatDuration(diffMs)} ago
      </span>
    );
  }
  if (diffMs <= urgentWindowMs) {
    return (
      <span
        suppressHydrationWarning
        className={`${BASE} border-amber-200 bg-amber-50 font-semibold text-amber-800`}
      >
        Due in {formatDuration(diffMs)}
      </span>
    );
  }
  return (
    <span
      suppressHydrationWarning
      className={`${BASE} border-emerald-200 bg-emerald-50 font-medium text-emerald-700`}
    >
      {formatDuration(diffMs)} left
    </span>
  );
}
