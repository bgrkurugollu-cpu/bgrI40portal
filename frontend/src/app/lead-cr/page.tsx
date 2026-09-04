import { prisma } from "@/lib/db";
import type { ProjectDTO } from "@/lib/types";
import { requirePageView } from "@/lib/permission-guard";
import { getRates, toTRY } from "@/lib/rates";
import type { CurrencyCode } from "@/lib/utils";
import { LeadCrClient } from "./lead-cr-client";

export const dynamic = "force-dynamic";

// Proje/demand kapsamı dışındaki işler (Lead, CR) — aynı Project modelini ve
// alt yapısını (Proje Planı, Ödeme Planı, Ekip Efor, JIRA linki vb.) "Projeler"
// ile birebir paylaşır; yalnızca ayrı bir menüde, risk/öncelik olmadan listelenir.
export default async function LeadCrPage() {
  await requirePageView("leadcr");
  const [projects, factories, rates] = await Promise.all([
    prisma.project.findMany({
      where: { kind: { in: ["LEAD", "CR"] } },
      include: { factories: true, financials: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
    getRates(),
  ]);

  const dtos: ProjectDTO[] = projects.map((p) => ({
    id: p.id,
    kind: p.kind,
    projectCode: p.projectCode,
    pipelineCode: p.pipelineCode,
    name: p.name,
    factoryIds: p.factories.map((f) => f.id),
    factoryNames: p.factories.map((f) => f.name),
    probability: p.probability,
    targetBudget: Number(p.targetBudget),
    // Ciro: Gelir + İç Kaynak Geliri (Bütçe & Finans/Proje detayıyla aynı formül), TL karşılığı.
    ciro: p.financials.reduce(
      (s, f) =>
        s +
        toTRY(Number(f.income), f.currency as CurrencyCode, rates) +
        toTRY(Number(f.internalIncome), f.currency as CurrencyCode, rates),
      0
    ),
    startDate: p.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: p.endDate?.toISOString().slice(0, 10) ?? null,
    riskLevel: p.riskLevel,
    priority: p.priority,
    status: p.status,
    description: p.description,
    jiraLink: p.jiraLink,
  }));

  return (
    <LeadCrClient
      items={dtos}
      factories={factories.map((f) => ({
        id: f.id,
        name: f.name,
        location: f.location,
      }))}
    />
  );
}
