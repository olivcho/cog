import type { ReactNode } from "react";
import type { FieldDef, ModelDefinition } from "../registry";
import { FieldValue } from "./FieldValue";

export interface ModelTableProps {
  model: ModelDefinition;
  columns: readonly FieldDef[];
  items: readonly Record<string, unknown>[];
  emptyMessage?: string;
  renderCell?: (
    field: FieldDef,
    value: unknown,
    record: Record<string, unknown>,
  ) => ReactNode | undefined;
  renderRowAction?: (record: Record<string, unknown>) => ReactNode;
  onRowClick?: (record: Record<string, unknown>) => void;
}

export function ModelTable({
  model,
  columns,
  items,
  emptyMessage,
  renderCell,
  renderRowAction,
  onRowClick,
}: ModelTableProps) {
  const idField = model.idField ?? "id";

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
        {emptyMessage ?? `No ${model.pluralLabel.toLowerCase()} found.`}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" className="px-4 py-3 whitespace-nowrap">
                {col.label}
              </th>
            ))}
            {renderRowAction ? (
              <th scope="col" className="px-4 py-3 text-right">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((record, index) => {
            const rowKey = String(record[idField] ?? index);
            return (
              <tr
                key={rowKey}
                onClick={onRowClick ? () => onRowClick(record) : undefined}
                className={
                  onRowClick
                    ? "cursor-pointer transition-colors hover:bg-slate-50"
                    : "transition-colors hover:bg-slate-50/60"
                }
              >
                {columns.map((col) => {
                  const custom = renderCell?.(col, record[col.key], record);
                  return (
                    <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                      {custom !== undefined ? (
                        custom
                      ) : (
                        <FieldValue field={col} value={record[col.key]} />
                      )}
                    </td>
                  );
                })}
                {renderRowAction ? (
                  <td
                    className="px-4 py-3 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {renderRowAction(record)}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
