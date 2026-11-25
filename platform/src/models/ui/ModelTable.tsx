"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { FieldDef, ModelDefinition } from "../registry";
import { FieldValue } from "./FieldValue";

export interface ModelTableProps {
  model: ModelDefinition;
  columns: readonly FieldDef[];
  items: readonly Record<string, unknown>[];
  emptyMessage?: string;
  showIndex?: boolean;
  renderCell?: (
    field: FieldDef,
    value: unknown,
    record: Record<string, unknown>,
  ) => ReactNode | undefined;
  renderRowAction?: (record: Record<string, unknown>) => ReactNode;
  onRowClick?: (record: Record<string, unknown>) => void;
}

const NUMERIC_TYPES = new Set<FieldDef["type"]>(["number", "risk_score"]);

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function ModelTable({
  model,
  columns,
  items,
  emptyMessage,
  showIndex,
  renderCell,
  renderRowAction,
  onRowClick,
}: ModelTableProps) {
  const idField = model.idField ?? "id";
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const rows = useMemo(() => {
    if (!sort) return items;
    return [...items].sort((a, b) => compare(a[sort.key], b[sort.key]) * sort.dir);
  }, [items, sort]);

  if (items.length === 0) {
    return (
      <p className="border-y border-hairline py-12 text-center text-[13px] text-ink-muted">
        {emptyMessage ?? `No ${model.pluralLabel.toLowerCase()} found.`}
      </p>
    );
  }

  function toggleSort(key: string) {
    setSort((prev) =>
      prev?.key === key ? (prev.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 },
    );
  }

  const cell = "px-3 py-2.5 first:pl-0 last:pr-0 whitespace-nowrap";

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-[13px]">
        <thead className="border-b border-hairline-strong text-xs text-ink-muted">
          <tr>
            {showIndex ? (
              <th scope="col" className={`${cell} w-10 font-normal`}>
                #
              </th>
            ) : null}
            {columns.map((col) => {
              const align = NUMERIC_TYPES.has(col.type) ? "text-right" : "";
              const active = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={
                    active ? (sort.dir === 1 ? "ascending" : "descending") : undefined
                  }
                  className={`${cell} font-normal ${align}`}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
                    >
                      {col.label}
                      <span aria-hidden className="text-[9px]">
                        {active ? (sort.dir === 1 ? "▲" : "▼") : "▼"}
                      </span>
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
            {renderRowAction ? (
              <th scope="col" className={`${cell} text-right font-normal`}>
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((record, index) => {
            const rowKey = String(record[idField] ?? index);
            return (
              <tr
                key={rowKey}
                onClick={onRowClick ? () => onRowClick(record) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter") onRowClick(record);
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={`border-b border-hairline transition-colors hover:bg-surface ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                {showIndex ? (
                  <td className={`${cell} font-mono text-xs tabular-nums text-ink-muted`}>
                    {String(index + 1).padStart(2, "0")}
                  </td>
                ) : null}
                {columns.map((col) => {
                  const custom = renderCell?.(col, record[col.key], record);
                  const align = NUMERIC_TYPES.has(col.type) ? "text-right" : "";
                  return (
                    <td key={col.key} className={`${cell} ${align}`}>
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
                    className={`${cell} text-right`}
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
