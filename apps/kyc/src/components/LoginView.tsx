"use client";

import { useState, type FormEvent } from "react";
import type { Role } from "@internal/platform/types";
import {
  Button,
  Meta,
  Notice,
  Tag,
  humanize,
  inputClass,
  labelClass,
} from "@internal/platform/ui";

interface DemoPersona {
  email: string;
  name: string;
  role: Role;
  password: string;
  description: string;
}

const ROLE_SUMMARY: Record<Role, string> = {
  analyst: "Approves cases with risk under 70",
  senior_reviewer: "Gives second sign-off on high-risk cases",
  compliance_admin: "Reassigns and approves any case",
  auditor: "Reads cases and the audit log",
};

function SectionLabel({
  index,
  title,
  aside,
}: {
  index: number;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-baseline gap-4 border-t border-hairline-strong pt-4">
      <Meta>{String(index).padStart(2, "0")}</Meta>
      <h2 className="flex-1 text-[15px]">{title}</h2>
      {aside}
    </div>
  );
}

export function LoginView({
  demoAccounts,
  onSuccess,
}: {
  demoAccounts: readonly DemoPersona[];
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);

  async function submitLogin(targetEmail: string, targetPassword: string) {
    setError(null);
    setLoadingEmail(targetEmail);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "We couldn't sign you in.");
        return;
      }
      onSuccess();
    } catch {
      setError("We couldn't reach the server. Try again.");
    } finally {
      setLoadingEmail(null);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submitLogin(email, password);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-12 max-w-[1040px] items-center justify-between px-8">
          <span className="text-[15px]">KYC review</span>
          <Meta>Internal tools</Meta>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1040px] flex-1 px-8 pt-24 pb-16">
        <h1 className="max-w-[18ch] text-[36px] leading-[1.1] tracking-[-0.02em]">
          Sign in to review KYC cases.
        </h1>

        <div className="mt-16 grid gap-16 md:grid-cols-[minmax(0,340px)_1fr]">
          <section>
            <SectionLabel index={1} title="Sign in" />
            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="login-password" className={labelClass}>
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              {error ? (
                <div role="alert">
                  <Notice label="Error" tone="danger">
                    {error}
                  </Notice>
                </div>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                disabled={loadingEmail !== null}
                className="w-full"
              >
                {loadingEmail === email && email !== ""
                  ? "Signing in…"
                  : "Sign in"}
              </Button>
            </form>
          </section>

          <section>
            <SectionLabel
              index={2}
              title="Demo accounts"
              aside={<Tag tone="muted">Demo</Tag>}
            />
            <ul className="border-t border-hairline">
              {demoAccounts.map((persona, i) => (
                <li key={persona.email} className="border-b border-hairline">
                  <button
                    type="button"
                    disabled={loadingEmail !== null}
                    onClick={() =>
                      void submitLogin(persona.email, persona.password)
                    }
                    className="group grid w-full grid-cols-[32px_1fr_auto] items-baseline gap-x-4 py-3.5 text-left transition-colors hover:bg-surface disabled:opacity-40"
                  >
                    <Meta>{String(i + 1).padStart(2, "0")}</Meta>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-3">
                        <span className="text-sm">{persona.name}</span>
                        <Meta className="break-all">{persona.email}</Meta>
                      </span>
                      <span className="mt-0.5 block text-[13px] text-ink-muted">
                        {ROLE_SUMMARY[persona.role]}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                      <Tag tone="muted">{humanize(persona.role)}</Tag>
                      <span className="w-[72px] text-right text-[13px] text-ink-muted group-hover:text-ink">
                        {loadingEmail === persona.email
                          ? "Signing in…"
                          : "Sign in →"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
