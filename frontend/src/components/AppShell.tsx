"use client";

import { type ReactNode, useState } from "react";
import { Menu, Factory, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

export function AppShell({
  authed,
  visiblePages,
  children,
}: {
  authed: boolean;
  visiblePages: string[] | null;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopExpanded, setDesktopExpanded] = useState(false); // Default to unexpanded (collapsed) on desktop

  if (!authed) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <Sidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        desktopExpanded={desktopExpanded}
        onToggleDesktop={() => setDesktopExpanded((prev) => !prev)}
        visiblePages={visiblePages}
      />

      {/* Mobil üst çubuk — sadece md altında görünür, sandviç menü butonu */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Menüyü aç"
          aria-expanded={mobileOpen}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Factory className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold">Endüstri 4.0 Portalı</span>
        </div>
      </header>

      <main 
        className={cn(
          "min-h-screen px-4 py-6 md:px-8 md:py-8 transition-all duration-300",
          desktopExpanded ? "md:ml-60" : "md:ml-[80px]"
        )}
      >
        {children}
      </main>
    </div>
  );
}
