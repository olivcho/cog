import type { ReactNode } from "react";
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

export function ModelDetail({
  model,
  fields,
  record,
  auditTrail,
  headerActions,
  renderField,
}: ModelDetailProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {model.label} Details
            </h2>
            <p className="text-xs text-slate-500">
              Permissions-enforced model view ({fields.length} visible fields)
            </p>
          </div>
          {headerActions ? (
            <div className="flex items-center gap-2">{headerActions}</div>
          ) : null}
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => {
            const custom = renderField?.(field, record[field.key], record);
            return (
              <div key={field.key} className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {field.label}
                </dt>
                <dd className="text-sm">
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
      </section>

      {auditTrail ? (
        <section className="rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Append-Only Audit Trail ({auditTrail.length})
            </h3>
          </div>
          {auditTrail.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-500">
              No audit events recorded yet.
            </p>
          ) : (
            <ol className="divide-y divide-slate-100 px-5">
              {auditTrail.map((entry) => {
                const ts =
                  entry.createdAt instanceof Date
                    ? entry.createdAt
                    : new Date(entry.createdAt);
                return (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
                  >
                    <div className="space-y-0.5">
                      <span className="font-medium text-slate-900">
                        {entry.action}
                      </span>{" "}
                      <span className="text-slate-500">by</span>{" "}
                      <span className="font-mono text-xs text-slate-700">
                        {entry.actorEmail}
                      </span>
                      {entry.reason ? (
                        <p className="text-xs text-slate-600">{entry.reason}</p>
                      ) : null}
                    </div>
                    <time
                      dateTime={ts.toISOString()}
                      className="text-xs tabular-nums text-slate-500"
                    >
                      {ts.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ) : null}
    </div>
  );
}
