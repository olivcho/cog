import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";

function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "border border-ink bg-ink text-paper hover:bg-ink/85",
  secondary: "border border-ink text-ink hover:bg-ink hover:text-paper",
  ghost: "border border-transparent text-ink-muted hover:text-ink",
  danger: "border border-danger/50 text-danger hover:border-danger hover:bg-danger hover:text-paper",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "h-7 px-2.5 text-[13px]" : "h-9 px-4 text-sm",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export type TagTone = "default" | "muted" | "danger";

const TAG_TONES: Record<TagTone, string> = {
  default: "text-ink",
  muted: "text-ink-muted",
  danger: "text-danger",
};

/** Bracketed mono label: `[HIGH RISK]`. */
export function Tag({
  tone = "default",
  className,
  children,
}: {
  tone?: TagTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.02em]",
        TAG_TONES[tone],
        className,
      )}
    >
      [{children}]
    </span>
  );
}

/** Selectable bracketed label used for filter rows. */
export function TagButton({
  selected,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        "whitespace-nowrap px-1.5 py-1 font-mono text-[11px] uppercase tracking-[0.02em] transition-colors",
        selected ? "bg-ink text-paper" : "text-ink-muted hover:text-ink",
        className,
      )}
      {...props}
    >
      [{children}]
    </button>
  );
}

/** Mono 12px metadata at 56% ink: dates, IDs, counts. */
export function Meta({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cx(
        "font-mono text-xs tracking-[-0.01em] text-ink-muted tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

/** Numbered document section: gutter index, title, optional aside. */
export function Section({
  index,
  title,
  aside,
  className,
  children,
}: {
  index: number;
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cx(
        "grid grid-cols-1 gap-x-8 gap-y-4 border-t border-hairline-strong pt-4 md:grid-cols-[64px_1fr]",
        className,
      )}
    >
      <Meta className="pt-0.5">{String(index).padStart(2, "0")}</Meta>
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px]">{title}</h2>
          {aside ? <div>{aside}</div> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

/** One-line notice. Replaces tinted callout boxes. */
export function Notice({
  label,
  tone = "default",
  children,
}: {
  label: string;
  tone?: TagTone;
  children: ReactNode;
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-2 text-[13px] text-ink">
      <Tag tone={tone}>{label}</Tag>
      <span>{children}</span>
    </p>
  );
}

export const inputClass =
  "w-full border border-hairline-strong bg-transparent px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none disabled:opacity-40";

export const selectClass =
  "h-7 border border-hairline-strong bg-transparent px-2 text-[13px] text-ink focus:border-ink focus:outline-none disabled:opacity-40";

export const labelClass = "mb-1.5 block text-[13px] text-ink-muted";
