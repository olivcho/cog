"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "./format";

const DEFAULT_URGENT_WINDOW_MS = 4 * 3600_000;

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.abs(ms) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${Math.max(minutes, 1)}m`;
}

const BASE = "font-mono text-xs tabular-nums";

export function SlaBadge({
  dueAt,
  closed = false,
  urgentWindowMs = DEFAULT_URGENT_WINDOW_MS,
  showDueDate = false,
}: {
  dueAt: string | Date;
  closed?: boolean;
  urgentWindowMs?: number;
  /** Show the exact deadline next to the remaining time. */
  showDueDate?: boolean;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (closed) {
    return <span className={`${BASE} text-ink-faint`}>closed</span>;
  }

  const due = new Date(dueAt);
  const dueLabel = `due ${formatDateTime(due)} UTC`;
  const diffMs = due.getTime() - now;
  const tone =
    diffMs < 0
      ? "text-danger"
      : diffMs <= urgentWindowMs
        ? "text-ink"
        : "text-ink-muted";

  return (
    <time
      dateTime={due.toISOString()}
      title={dueLabel}
      suppressHydrationWarning
      className={`${BASE} ${tone}`}
    >
      {formatDuration(diffMs)} {diffMs < 0 ? "over" : "left"}
      {showDueDate ? (
        <span className="text-ink-muted"> · {dueLabel}</span>
      ) : (
        <span className="sr-only">, {dueLabel}</span>
      )}
    </time>
  );
}
