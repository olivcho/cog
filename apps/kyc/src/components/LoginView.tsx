"use client";

import { useState, type FormEvent } from "react";
import type { Role } from "@internal/platform/types";

interface DemoPersona {
  email: string;
  name: string;
  role: Role;
  password: string;
  description: string;
}

const ROLE_BADGES: Record<Role, string> = {
  analyst: "bg-blue-50 text-blue-700 border-blue-200",
  senior_reviewer: "bg-indigo-50 text-indigo-700 border-indigo-200",
  compliance_admin: "bg-purple-50 text-purple-700 border-purple-200",
  auditor: "bg-slate-100 text-slate-700 border-slate-300",
};

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
        setError(data.error ?? "Sign-in failed");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error while signing in");
    } finally {
      setLoadingEmail(null);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submitLogin(email, password);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Horizontal Internal Tools Platform
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          KYC Review Queue
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with email &amp; password or choose a seeded fintech persona to inspect role-based permissions, two-person approvals, and the append-only audit trail.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">
            Sign in with credentials
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Session cookies are HMAC-SHA256 signed, HTTP-only, and backed by SQLite.
          </p>

          <form onSubmit={handleFormSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@fintech.demo"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loadingEmail !== null}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loadingEmail === email && email !== ""
                ? "Signing in..."
                : "Sign in"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                One-Click Demo Personas
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Authenticates through the real <code className="font-mono">/api/auth/login</code> endpoint.
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
              Demo Mode
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {demoAccounts.map((persona) => (
              <button
                key={persona.email}
                type="button"
                disabled={loadingEmail !== null}
                onClick={() => void submitLogin(persona.email, persona.password)}
                className="flex flex-col items-start rounded-lg border border-slate-200 p-4 text-left transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-slate-900">
                    {persona.name}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGES[persona.role]}`}
                  >
                    {persona.role.replace("_", " ")}
                  </span>
                </div>
                <span className="mt-1 font-mono text-[11px] text-slate-500">
                  {persona.email}
                </span>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {persona.description}
                </p>
                <span className="mt-3 text-xs font-medium text-slate-900">
                  {loadingEmail === persona.email
                    ? "Signing in..."
                    : "Sign in as this role →"}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
