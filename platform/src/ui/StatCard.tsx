import type { ReactNode } from "react";

export type StatTone = "default" | "warning" | "danger" | "danger-subtle";

const VALUE_TONE: Record<StatTone, string> = {
  default: "text-ink",
  warning: "text-ink",
  danger: "text-danger",
  "danger-subtle": "text-danger",
};

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-2 border-y border-hairline py-3 text-[13px]">
      {children}
    </dl>
  );
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
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`font-mono tabular-nums ${VALUE_TONE[tone]}`}>{value}</dd>
    </div>
  );
}
