function parts(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

/** `YYYY.MM.DD`, UTC. */
export function formatDate(value: Date | string): string {
  return parts(value)?.date ?? String(value);
}

/** `YYYY.MM.DD HH:MM`, UTC, 24h. */
export function formatDateTime(value: Date | string): string {
  const p = parts(value);
  return p ? `${p.date} ${p.time}` : String(value);
}

/** `snake_case` → `snake case`. */
export function humanize(raw: string): string {
  return raw.replace(/_/g, " ");
}
