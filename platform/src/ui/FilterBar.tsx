import type { ReactNode } from "react";
import { selectClass } from "./primitives";

export interface FilterOption {
  value: string;
  label: string;
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">{children}</div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <input
      type="search"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${selectClass} w-56 placeholder:text-ink-faint`}
    />
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  /** Accessible label for the select. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly FilterOption[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={selectClass}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
