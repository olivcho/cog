import type { ReactNode } from "react";
import { HIGH_RISK_THRESHOLD } from "../../types";
import { formatDateTime, humanize } from "../../ui/format";
import { Tag, type TagTone } from "../../ui/primitives";
import type { FieldDef } from "../registry";

const BADGE_TONES: Record<string, TagTone> = {
  approved: "muted",
  rejected: "muted",
  escalated: "danger",
};

const EMPTY_VALUE = <span className="text-ink-faint">—</span>;

export function RiskScore({ score }: { score: number }) {
  const high = score >= HIGH_RISK_THRESHOLD;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`w-6 text-right font-mono text-[13px] tabular-nums ${high ? "text-danger" : "text-ink"}`}
      >
        {score}
      </span>
      <span aria-hidden className="relative h-px w-12 bg-hairline-strong">
        <span
          className={`absolute inset-y-[-1px] left-0 ${high ? "bg-danger" : "bg-ink"}`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </span>
    </span>
  );
}

export function FieldValue({
  field,
  value,
}: {
  field: FieldDef;
  value: unknown;
}): ReactNode {
  if (value === null || value === undefined || value === "") {
    return EMPTY_VALUE;
  }

  switch (field.type) {
    case "boolean":
      return <span>{value ? "yes" : "no"}</span>;

    case "date": {
      const d = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(d.getTime())) return <span>{String(value)}</span>;
      return (
        <time
          dateTime={d.toISOString()}
          className="font-mono text-xs tabular-nums text-ink-muted"
        >
          {formatDateTime(d)}
        </time>
      );
    }

    case "risk_score":
      return <RiskScore score={Number(value)} />;

    case "badge": {
      const key = String(value);
      return <Tag tone={BADGE_TONES[key] ?? "default"}>{humanize(key)}</Tag>;
    }

    case "email":
      return (
        <span className="font-mono text-xs text-ink-muted">{String(value)}</span>
      );

    case "number":
      return <span className="font-mono tabular-nums">{String(value)}</span>;

    default:
      return <span>{String(value)}</span>;
  }
}
