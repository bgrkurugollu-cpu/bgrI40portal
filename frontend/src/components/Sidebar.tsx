"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Wallet,
  KeyRound,
  LogOut,
  Moon,
  Sun,
  Factory,
  FileStack,
  Banknote,
  ShieldCheck,
  ChevronsUpDown,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

const nav = [
  { href: "/", label: "Genel Bakış", icon: LayoutDashboard },
  { href: "/projects", label: "Projeler", icon: FolderKanban },
  { href: "/pt", label: "PT Kodları", icon: FileStack },
  { href: "/resources", label: "Kaynak Planı", icon: Users },
  { href: "/finance", label: "Bütçe & Finans", icon: Wallet },
  { href: "/capex", label: "CAPEX Bütçesi", icon: Banknote },
  { href: "/licenses", label: "Lisanslar", icon: KeyRound },
];

export function Sidebar({
  open,
  onClose,
  desktopExpanded = false,
  onToggleDesktop,
}: {
  open: boolean;
  onClose: () => void;
  desktopExpanded?: boolean;
  onToggleDesktop?: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dışarı tıklayınca menüyü kapat
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // Sayfa değiştiğinde mobil menüyü otomatik kapat
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const isAdmin = user?.role === "ADMIN";

  return (
    <>
      {/* Mobil karartma perdesi — menü açıkken içeriğin üzerine gelir, tıklanınca kapanır */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-all duration-300 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          desktopExpanded ? "md:w-60" : "md:w-[80px]"
        )}
      >
      {onToggleDesktop && (
        <button
          onClick={onToggleDesktop}
          className="hidden md:flex absolute -right-3 top-7 h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-muted text-muted-foreground z-50"
        >
          {desktopExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      )}
      <div className={cn("flex items-center gap-2.5 px-5 py-5", !desktopExpanded && "md:justify-center md:px-0")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Factory className="h-5 w-5" />
        </div>
        <div className={cn("flex-1 overflow-hidden transition-all", desktopExpanded ? "opacity-100" : "md:hidden")}>
          <div className="text-sm font-bold leading-tight truncate">Endüstri 4.0 Yönetim Portalı</div>
          <div className="text-xs text-muted-foreground truncate">DBD Ekibi Yönetim Portalı</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Menüyü kapat"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={!desktopExpanded ? label : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                !desktopExpanded && "md:justify-center md:px-0",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {active && <div className="absolute inset-0 rounded-lg bg-accent" />}
              <Icon className="relative z-10 h-5 w-5 shrink-0" />
              <span className={cn("relative z-10 truncate transition-all", desktopExpanded ? "w-auto opacity-100" : "md:hidden")}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div ref={menuRef} className="relative border-t px-3 py-3">
        {menuOpen && (
            <div className={cn(
              "absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border bg-card p-1.5 shadow-xl",
              !desktopExpanded && "md:left-full md:right-auto md:ml-3 md:w-56"
            )}>
              <div className="border-b px-3 pt-1.5 pb-2.5">
                <div className="truncate text-sm font-semibold">{user?.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </div>
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary">
                  {isAdmin && <ShieldCheck className="h-3 w-3" />}
                  {isAdmin ? "Admin" : "Kullanıcı"}
                </span>
              </div>
              <div className="mt-1.5 space-y-0.5">
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      pathname.startsWith("/admin")
                        ? "bg-accent text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Yönetim Paneli
                  </Link>
                )}
                <Link
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    pathname.startsWith("/account")
                      ? "bg-accent text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <KeyRound className="h-4 w-4" />
                  Hesabım
                </Link>
                <button
                  onClick={toggle}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  {theme === "dark" ? "Açık Tema" : "Koyu Tema"}
                </button>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Çıkış Yap
                </button>
              </div>
            </div>
        )}

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
            !desktopExpanded && "md:justify-center md:px-0",
            menuOpen ? "bg-muted" : "hover:bg-muted"
          )}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className={cn("min-w-0 flex-1 transition-all", desktopExpanded ? "opacity-100" : "md:hidden")}>
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {isAdmin ? "Admin" : "Kullanıcı"}
            </div>
          </div>
          <ChevronsUpDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground",
              !desktopExpanded && "md:hidden"
            )}
          />
        </button>
      </div>
      </aside>
    </>
  );
}
