import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { APP_PAGES, DEFAULT_EDIT, type PageKey } from "@/lib/permissions";

export async function getEffectivePermission(userId: string, page: PageKey) {
  const row = await prisma.userPagePermission.findUnique({
    where: { userId_page: { userId, page } },
  });
  if (!row) return { canView: true, canEdit: DEFAULT_EDIT[page] };
  return { canView: row.canView, canEdit: row.canEdit };
}

// Sayfa bileşenlerinde (server component) çağrılır — görüntüleme izni yoksa yönlendirir.
export async function requirePageView(page: PageKey) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") return session;
  const perm = await getEffectivePermission(session.sub, page);
  if (!perm.canView) redirect("/account");
  return session;
}

// Server action'larda çağrılır — düzenleme izni yoksa hata fırlatır.
export async function requirePageEdit(page: PageKey) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");
  if (session.role === "ADMIN") return session;
  const perm = await getEffectivePermission(session.sub, page);
  if (!perm.canEdit) throw new Error("Yetkisiz — bu sayfada düzenleme izniniz yok.");
  return session;
}

// Sidebar'da hangi sayfaların görüneceğini belirlemek için — admin için null (tümü görünür).
export async function getVisiblePageKeys(userId: string, role: string): Promise<Set<PageKey> | null> {
  if (role === "ADMIN") return null;
  const rows = await prisma.userPagePermission.findMany({ where: { userId } });
  const byPage = new Map(rows.map((r) => [r.page, r.canView]));
  const visible = new Set<PageKey>();
  for (const p of APP_PAGES) {
    const canView = byPage.has(p.key) ? byPage.get(p.key)! : true;
    if (canView) visible.add(p.key);
  }
  return visible;
}
