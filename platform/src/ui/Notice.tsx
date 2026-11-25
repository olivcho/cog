import type { ReactNode } from "react";

export function Notice({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs text-slate-700">
      {title ? <strong>{title}: </strong> : null}
      {children}
    </div>
  );
}
