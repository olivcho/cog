import type { ReactNode } from "react";
import { formatDateTime } from "../../ui/format";
import { Meta, Section } from "../../ui/primitives";
import type { FieldDef, ModelDefinition } from "../registry";
import { FieldValue } from "./FieldValue";

export interface AuditEntryView {
  id: string;
  actorEmail: string;
  action: string;
  reason?: string | null;
  createdAt: Date | string;
}

export interface ModelDetailProps {
  model: ModelDefinition;
  fields: readonly FieldDef[];
  record: Record<string, unknown>;
  auditTrail?: readonly AuditEntryView[];
  headerActions?: ReactNode;
  renderField?: (
    field: FieldDef,
    value: unknown,
    record: Record<string, unknown>,
  ) => ReactNode | undefined;
}

export function AuditTrail({
  entries,
}: {
  entries: readonly AuditEntryView[];
}) {
  if (entries.length === 0) {
    return <p className="text-[13px] text-ink-muted">No events yet.</p>;
  }
  return (
    <ol className="border-t border-hairline">
      {entries.map((entry) => {
        const ts =
          entry.createdAt instanceof Date
            ? entry.createdAt
            : new Date(entry.createdAt);
        return (
          <li
            key={entry.id}
            className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-hairline py-2.5 font-mono text-xs sm:grid-cols-[136px_1fr]"
          >
            <time dateTime={ts.toISOString()} className="tabular-nums text-ink-muted">
              {formatDateTime(ts)}
            </time>
            <div className="min-w-0">
              <span className="text-ink">{entry.action}</span>
              <span className="text-ink-muted"> — {entry.actorEmail}</span>
              {entry.reason ? (
                <p className="mt-1 font-sans text-[13px] text-ink-muted">
                  {entry.reason}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ModelDetail({
  model,
  fields,
  record,
  auditTrail,
  headerActions,
  renderField,
}: ModelDetailProps) {
  return (
    <div className="space-y-10">
      <Section index={1} title={model.label} aside={headerActions}>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => {
            const custom = renderField?.(field, record[field.key], record);
            return (
              <div key={field.key}>
                <dt>
                  <Meta>{field.label}</Meta>
                </dt>
                <dd className="mt-1 text-[13px]">
                  {custom !== undefined ? (
                    custom
                  ) : (
                    <FieldValue field={field} value={record[field.key]} />
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </Section>

      {auditTrail ? (
        <Section
          index={2}
          title="Audit trail"
          aside={<Meta>{auditTrail.length} events</Meta>}
        >
          <AuditTrail entries={auditTrail} />
        </Section>
      ) : null}
    </div>
  );
}
