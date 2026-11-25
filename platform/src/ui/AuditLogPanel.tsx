"use client";

import { useCallback, useEffect, useState } from "react";

export interface AuditLogEntry {
  id: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  createdAt: string;
}

const UTC_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export function AuditLogPanel({
  endpoint = "/api/audit",
  title = "Append-Only Organization Audit Log",
}: {
  endpoint?: string;
  title?: string;
}) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { entries: AuditLogEntry[] };
    setEntries(data.entries);
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {title} ({entries.length})
          </h2>
          <p className="text-xs text-slate-500">
            Written automatically via Prisma <code className="font-mono">$extends</code> on
            every mutation. Updates and deletes throw <code className="font-mono">403</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-600">
                  {UTC_FORMATTER.format(new Date(entry.createdAt))}
                </td>
                <td className="px-4 py-2.5 font-mono text-slate-700">{entry.actorEmail}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-800">
                    {entry.action}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-slate-600">{entry.entityType}</td>
                <td className="px-4 py-2.5 text-slate-700">{entry.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
