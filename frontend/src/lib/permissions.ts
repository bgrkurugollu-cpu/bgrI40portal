// Uygulamadaki yetkilendirilebilir sayfaların merkezi kaydı.
// Client ve server tarafından ortak kullanılır — burada prisma/auth importu YOK.

export const APP_PAGES = [
  { key: "dashboard", label: "Genel Bakış", href: "/", hasEdit: false, defaultEdit: false },
  { key: "projects", label: "Projeler", href: "/projects", hasEdit: true, defaultEdit: true },
  { key: "leadcr", label: "Lead / CR", href: "/lead-cr", hasEdit: true, defaultEdit: true },
  { key: "pt", label: "PT Kodları", href: "/pt", hasEdit: true, defaultEdit: true },
  { key: "resources", label: "Kaynak Planı", href: "/resources", hasEdit: true, defaultEdit: false },
  { key: "finance", label: "Bütçe & Finans", href: "/finance", hasEdit: false, defaultEdit: false },
  { key: "capex", label: "CAPEX Bütçesi", href: "/capex", hasEdit: true, defaultEdit: false },
  { key: "licenses", label: "Lisanslar", href: "/licenses", hasEdit: true, defaultEdit: true },
] as const;

export type PageKey = (typeof APP_PAGES)[number]["key"];

export const DEFAULT_EDIT: Record<PageKey, boolean> = Object.fromEntries(
  APP_PAGES.map((p) => [p.key, p.defaultEdit])
) as Record<PageKey, boolean>;

export type PagePermission = { canView: boolean; canEdit: boolean };
