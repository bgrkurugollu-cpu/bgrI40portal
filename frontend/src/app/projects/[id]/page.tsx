import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import type {
  AssignmentDTO,
  BudgetItemDTO,
  FinancialDTO,
  InvoiceDTO,
  LogDTO,
  ProjectDTO,
  RatesDTO,
} from "@/lib/types";
import { getRates, toTRY } from "@/lib/rates";
import type { CurrencyCode } from "@/lib/utils";
import { ProjectDetailClient } from "./detail-client";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      factories: true,
      logs: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      },
      assignments: { include: { member: true }, orderBy: [{ year: "asc" }, { month: "asc" }] },
      budgetItems: true,
      financials: { orderBy: [{ year: "asc" }, { month: "asc" }] },
      invoices: { orderBy: { issueDate: "asc" } },
    },
  });
  if (!project) notFound();

  const [factories, members, rates] = await Promise.all([
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getRates(),
  ]);

  const dto: ProjectDTO = {
    id: project.id,
    projectCode: project.projectCode,
    name: project.name,
    factoryIds: project.factories.map((f) => f.id),
    factoryNames: project.factories.map((f) => f.name),
    probability: project.probability,
    targetBudget: Number(project.targetBudget),
    startDate: project.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: project.endDate?.toISOString().slice(0, 10) ?? null,
    riskLevel: project.riskLevel,
    priority: project.priority,
    status: project.status,
    description: project.description,
  };

  const logs: LogDTO[] = project.logs.map((l) => ({
    id: l.id,
    field: l.field,
    oldValue: l.oldValue,
    newValue: l.newValue,
    createdAt: l.createdAt.toISOString(),
    userName: l.user?.name ?? null,
  }));

  const assignments: AssignmentDTO[] = project.assignments.map((a) => ({
    id: a.id,
    projectId: a.projectId,
    memberId: a.memberId,
    memberName: a.member.name,
    year: a.year,
    month: a.month,
    plannedDays: Number(a.plannedDays),
    actualDays: Number(a.actualDays),
    resources: a.resources,
  }));

  const budgetItems: BudgetItemDTO[] = project.budgetItems.map((b) => {
    const currency = b.currency as CurrencyCode;
    return {
      id: b.id,
      year: b.year,
      category: b.category,
      description: b.description,
      quantity: Number(b.quantity),
      unitPrice: Number(b.unitPrice),
      amount: Number(b.amount),
      currency,
      amountTRY: toTRY(Number(b.amount), currency, rates),
    };
  });

  const financials: FinancialDTO[] = project.financials.map((f) => {
    const currency = f.currency as CurrencyCode;
    return {
      id: f.id,
      projectId: f.projectId,
      year: f.year,
      month: f.month,
      income: Number(f.income),
      expense: Number(f.expense),
      internalIncome: Number(f.internalIncome),
      currency,
      incomeTRY: toTRY(Number(f.income), currency, rates),
      expenseTRY: toTRY(Number(f.expense), currency, rates),
      internalIncomeTRY: toTRY(Number(f.internalIncome), currency, rates),
    };
  });

  const invoices: InvoiceDTO[] = project.invoices.map((i) => {
    const currency = i.currency as CurrencyCode;
    return {
      id: i.id,
      projectId: i.projectId,
      description: i.description,
      amount: Number(i.amount),
      currency,
      amountTRY: toTRY(Number(i.amount), currency, rates),
      issueDate: i.issueDate.toISOString().slice(0, 10),
      status: i.status,
      ebaNumber: i.ebaNumber,
      poNumber: i.poNumber,
    };
  });

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
    <ProjectDetailClient
      project={dto}
      logs={logs}
      assignments={assignments}
      budgetItems={budgetItems}
      financials={financials}
      invoices={invoices}
      rates={ratesDto}
      factories={factories.map((f) => ({ id: f.id, name: f.name, location: f.location }))}
      members={members.map((m) => ({ id: m.id, name: m.name, title: m.title }))}
    />
  );
}
