import { prisma } from "@/lib/db";
import { requirePageView, getEffectivePermission } from "@/lib/permission-guard";
import { getRates } from "@/lib/rates";
import type { CapexBudgetDTO, RatesDTO } from "@/lib/types";
import type { CurrencyCode } from "@/lib/utils";
import { CapexClient } from "./capex-client";

export const dynamic = "force-dynamic";

export default async function CapexPage() {
  const session = await requirePageView("capex");
  const isAdmin =
    session.role === "ADMIN" || (await getEffectivePermission(session.sub, "capex")).canEdit;

  const [budgets, factories, projects, rates] = await Promise.all([
    prisma.capexBudget.findMany({
      orderBy: { year: "desc" },
      include: {
        mainItems: {
          orderBy: { order: "asc" },
          include: {
            factories: { select: { id: true, name: true } },
            subItems: {
              orderBy: { order: "asc" },
              include: { project: { select: { id: true, projectCode: true, name: true } } },
            },
          },
        },
      },
    }),
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, projectCode: true, name: true },
    }),
    getRates(),
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
        projectId: s.projectId,
        projectCode: s.project?.projectCode ?? null,
        projectName: s.project?.name ?? null,
        title: s.title,
        budget: Number(s.budget),
        note: s.note,
        order: s.order,
      })),
    })),
  }));

  const ratesDto: RatesDTO = {
    TRY: rates.TRY,
    USD: rates.USD,
    EUR: rates.EUR,
    GBP: rates.GBP,
    date: rates.date,
    time: rates.time,
    source: rates.source,
  };

  return (
    <CapexClient
      budgets={dtos}
      factories={factories.map((f) => ({ id: f.id, name: f.name, location: f.location }))}
      projects={projects}
      rates={ratesDto}
      isAdmin={isAdmin}
    />
  );
}
