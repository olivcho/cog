"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "./format";
import { Button, Meta } from "./primitives";

export interface AuditLogEntry {
  id: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  createdAt: string;
}

export function AuditLogPanel({
  endpoint = "/api/audit",
  title = "Audit log",
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
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl tracking-[-0.02em]">{title}</h1>
        <div className="flex items-baseline gap-4">
          <Meta>{entries.length} events</Meta>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[13px]">
          <thead className="border-b border-hairline-strong text-xs text-ink-muted">
            <tr>
              <th className="py-2 pr-3 font-normal">Time (UTC)</th>
              <th className="px-3 py-2 font-normal">Actor</th>
              <th className="px-3 py-2 font-normal">Action</th>
              <th className="px-3 py-2 font-normal">Entity</th>
              <th className="py-2 pl-3 font-normal">Reason</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-hairline align-baseline">
                <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-xs tabular-nums text-ink-muted">
                  {formatDateTime(entry.createdAt)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
                  {entry.actorEmail}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">{entry.action}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-ink-muted">
                  {entry.entityType}
                </td>
                <td className="py-2.5 pl-3">{entry.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
