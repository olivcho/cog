import type { ReactNode } from "react";
import { HIGH_RISK_THRESHOLD } from "../../types";
import type { FieldDef } from "../registry";

const BADGE_STYLES: Record<string, string> = {
  open: "bg-slate-100 text-slate-800 border-slate-200",
  in_review: "bg-blue-50 text-blue-700 border-blue-200",
  pending: "bg-blue-50 text-blue-700 border-blue-200",
  pending_second_approval: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  escalated: "bg-purple-50 text-purple-700 border-purple-200",
};

function formatStatusLabel(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FieldValue({
  field,
  value,
}: {
  field: FieldDef;
  value: unknown;
}): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-400">—</span>;
  }

  switch (field.type) {
    case "boolean":
      return (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
            value
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-100 text-slate-600"
          }`}
        >
          {value ? "Yes" : "No"}
        </span>
      );

    case "date": {
      const d = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(d.getTime())) return <span>{String(value)}</span>;
      return (
        <time dateTime={d.toISOString()} className="tabular-nums text-slate-700">
          {d.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      );
    }

    case "risk_score": {
      const score = Number(value);
      const tone =
        score >= HIGH_RISK_THRESHOLD
          ? "border-red-200 bg-red-50 text-red-700"
          : score >= 40
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-700";
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${tone}`}
        >
          {score}
          {score >= HIGH_RISK_THRESHOLD ? " · High" : ""}
        </span>
      );
    }

    case "badge": {
      const key = String(value);
      const tone =
        BADGE_STYLES[key] ?? "border-slate-200 bg-slate-100 text-slate-700";
      return (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}
        >
          {formatStatusLabel(key)}
        </span>
      );
    }

    case "email":
      return (
        <span className="font-mono text-xs text-slate-700">{String(value)}</span>
      );

    case "number":
      return <span className="tabular-nums">{String(value)}</span>;

    default:
      return <span className="text-slate-900">{String(value)}</span>;
  }
}
