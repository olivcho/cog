"use client";

import type { ReactNode } from "react";
import { Button, Meta, Tag } from "./primitives";
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
    <div className="min-h-screen">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-12 max-w-[1280px] items-center justify-between gap-6 px-8">
          <div className="flex h-full items-center gap-10">
            <span className="text-[15px]">{appName}</span>
            {tabs && tabs.length > 0 ? (
              <nav className="flex h-full items-center gap-6 text-[13px]">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange?.(tab.id)}
                    aria-current={activeTab === tab.id ? "page" : undefined}
                    className={`h-full transition-colors ${
                      activeTab === tab.id
                        ? "text-accent shadow-[inset_0_-1px_0_var(--color-accent)]"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[13px]">{user.name}</span>
            <Meta>{user.role}</Meta>
            {user.role === "auditor" ? <Tag tone="muted">Read-only</Tag> : null}
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-8 py-10">
        {banner ? <div className="mb-8">{banner}</div> : null}
        {children}
      </main>
    </div>
  );
}
