"use client";

import { type ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({
  authed,
  children,
}: {
  authed: boolean;
  children: ReactNode;
}) {
  if (!authed) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="ml-60 min-h-screen px-8 py-8">{children}</main>
    </div>
  );
}
