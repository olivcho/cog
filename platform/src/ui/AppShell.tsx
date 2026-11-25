"use client";

import type { ReactNode } from "react";
import { useSession } from "./session-context";

export interface AppShellTab<T extends string = string> {
  id: T;
  label: string;
}

export interface AppShellProps<T extends string> {
  appName: string;
  tabs?: readonly AppShellTab<T>[];
  activeTab?: T;
  onTabChange?: (tab: T) => void;
  /** Rendered above page content, e.g. a role-specific <Notice>. */
  banner?: ReactNode;
  children: ReactNode;
}

export function AppShell<T extends string>({
  appName,
  tabs,
  activeTab,
  onTabChange,
  banner,
  children,
}: AppShellProps<T>) {
  const { user, signOut } = useSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Internal Tools Platform
              </p>
              <h1 className="text-base font-bold text-slate-900">{appName}</h1>
            </div>

            {tabs && tabs.length > 0 ? (
              <nav className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange?.(tab.id)}
                    aria-current={activeTab === tab.id ? "page" : undefined}
                    className={`rounded-md px-3 py-1.5 transition ${
                      activeTab === tab.id
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-900">{user.name}</div>
              <div className="font-mono text-[11px] text-slate-500">{user.role}</div>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Switch Role / Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {banner ? <div className="mb-5">{banner}</div> : null}
        {children}
      </main>
    </div>
  );
}
