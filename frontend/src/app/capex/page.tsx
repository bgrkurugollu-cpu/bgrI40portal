import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { CapexBudgetDTO } from "@/lib/types";
import type { CurrencyCode } from "@/lib/utils";
import { CapexClient } from "./capex-client";

export const dynamic = "force-dynamic";

export default async function CapexPage() {
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN";

  const [budgets, factories] = await Promise.all([
    prisma.capexBudget.findMany({
      orderBy: { year: "desc" },
      include: {
        mainItems: {
          orderBy: { order: "asc" },
          include: {
            factories: { select: { id: true, name: true } },
            subItems: { orderBy: { order: "asc" } },
          },
        },
      },
    }),
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
  ]);

  const dtos: CapexBudgetDTO[] = budgets.map((b) => ({
    id: b.id,
    year: b.year,
    currency: b.currency as CurrencyCode,
    title: b.title,
    totalBudget: Number(b.totalBudget),
    mainItems: b.mainItems.map((m) => ({
      id: m.id,
      capexBudgetId: m.capexBudgetId,
      title: m.title,
      budget: Number(m.budget),
      spent: Number(m.spent),
      description: m.description,
      order: m.order,
      factoryIds: m.factories.map((f) => f.id),
      factoryNames: m.factories.map((f) => f.name),
      subItems: m.subItems.map((s) => ({
        id: s.id,
        mainItemId: s.mainItemId,
        title: s.title,
        budget: Number(s.budget),
        note: s.note,
        order: s.order,
      })),
    })),
  }));

  return (
    <CapexClient
      budgets={dtos}
      factories={factories.map((f) => ({ id: f.id, name: f.name, location: f.location }))}
      isAdmin={isAdmin}
    />
  );
}
