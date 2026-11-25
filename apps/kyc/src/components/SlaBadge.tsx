"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@internal/platform/ui";

function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const totalMinutes = Math.floor(abs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${Math.max(minutes, 1)}m`;
}

export function SlaBadge({
  slaDueAt,
  status,
}: {
  slaDueAt: string;
  status: string;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const base = "font-mono text-xs tabular-nums";

  if (status === "approved" || status === "rejected") {
    return <span className={`${base} text-ink-faint`}>closed</span>;
  }

  const diffMs = new Date(slaDueAt).getTime() - now;
  const title = `Due ${formatDateTime(slaDueAt)} UTC`;

  if (diffMs < 0) {
    return (
      <span suppressHydrationWarning title={title} className={`${base} text-danger`}>
        {formatDuration(diffMs)} over
      </span>
    );
  }

  return (
    <span
      suppressHydrationWarning
      title={title}
      className={`${base} ${diffMs <= 4 * 3600_000 ? "text-ink" : "text-ink-muted"}`}
    >
      {formatDuration(diffMs)} left
    </span>
  );
}
