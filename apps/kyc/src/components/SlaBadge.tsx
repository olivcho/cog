"use client";

import { useEffect, useState } from "react";

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
  if (hours > 0) return `${hours}h ${minutes}m`;
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

  if (status === "approved" || status === "rejected") {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500">
        Closed
      </span>
    );
  }

  const diffMs = new Date(slaDueAt).getTime() - now;
  if (diffMs < 0) {
    return (
      <span
        suppressHydrationWarning
        className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-red-700"
      >
        Breached {formatDuration(diffMs)} ago
      </span>
    );
  }

  if (diffMs <= 4 * 3600_000) {
    return (
      <span
        suppressHydrationWarning
        className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-amber-800"
      >
        Due in {formatDuration(diffMs)}
      </span>
    );
  }

  return (
    <span
      suppressHydrationWarning
      className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium tabular-nums text-emerald-700"
    >
      {formatDuration(diffMs)} left
    </span>
  );
}
