import type { ReactNode } from "react";

export type StatTone = "default" | "warning" | "danger" | "danger-subtle";

const TONES: Record<StatTone, { card: string; label: string; value: string }> = {
  default: { card: "border-slate-200 bg-white", label: "text-slate-500", value: "text-slate-900" },
  warning: { card: "border-amber-200 bg-amber-50/50", label: "text-amber-800", value: "text-amber-900" },
  danger: { card: "border-red-200 bg-red-50/40", label: "text-red-700", value: "text-red-700" },
  "danger-subtle": { card: "border-red-200 bg-white", label: "text-slate-500", value: "text-red-600" },
};

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>;
}

export function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: StatTone;
}) {
  const t = TONES[tone];
  return (
    <div className={`rounded-xl border p-4 shadow-xs ${t.card}`}>
      <div className={`text-xs font-medium ${t.label}`}>{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${t.value}`}>{value}</div>
    </div>
  );
}
