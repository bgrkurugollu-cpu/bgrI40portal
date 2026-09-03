import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getEffectivePermission } from "@/lib/permission-guard";
import type {
  AssignmentDTO,
  BudgetItemDTO,
  FinancialDTO,
  InvoiceDTO,
  LogDTO,
  ProjectDTO,
  ProjectTaskDTO,
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

  const session = await getSession();
  if (!session) redirect("/login");

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
      tasks: {
        orderBy: [{ order: "asc" }, { startDate: "asc" }],
        include: {
          assignees: {
            include: { member: true, weekAllocations: true },
          },
        },
      },
    },
  });
  if (!project) notFound();

  const pageKey = project.kind === "PROJECT" ? "projects" : "leadcr";
  if (session.role !== "ADMIN") {
    const viewPerm = await getEffectivePermission(session.sub, pageKey);
    if (!viewPerm.canView) redirect("/account");
  }
  const isAdmin =
    session.role === "ADMIN" || (await getEffectivePermission(session.sub, "resources")).canEdit;
  const isSuperAdmin = session.role === "ADMIN";

  const [factories, members, rates] = await Promise.all([
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getRates(),
  ]);

  const dto: ProjectDTO = {
    id: project.id,
    kind: project.kind,
    projectCode: project.projectCode,
    pipelineCode: project.pipelineCode,
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
    jiraLink: project.jiraLink,
    paymentPlanNote: project.paymentPlanNote,
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
      expenseType: b.expenseType,
      category: b.category,
      description: b.description,
      supplier: b.supplier,
      unit: b.unit,
      quantity: Number(b.quantity),
      unitPrice: Number(b.unitPrice),
      amount: Number(b.amount),
      currency,
      amountTRY: toTRY(Number(b.amount), currency, rates),
      note: b.note,
      transferFeePercent: b.transferFeePercent != null ? Number(b.transferFeePercent) : null,
      transferPrice: b.transferPrice != null ? Number(b.transferPrice) : null,
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
      type: i.type,
      description: i.description,
      amount: Number(i.amount),
      currency,
      amountTRY: toTRY(Number(i.amount), currency, rates),
      issueDate: i.issueDate.toISOString().slice(0, 10),
      status: i.status,
      ebaNumber: i.ebaNumber,
      poNumber: i.poNumber,
      hasExchangeRateDiff: i.hasExchangeRateDiff,
      exchangeRateDiffEbaNumber: i.exchangeRateDiffEbaNumber,
    };
  });

  const tasks: ProjectTaskDTO[] = project.tasks.map((t) => ({
    id: t.id,
    projectId: t.projectId,
    parentId: t.parentId,
    title: t.title,
    type: t.type,
    color: t.color,
    startDate: t.startDate.toISOString().slice(0, 10),
    endDate: t.endDate.toISOString().slice(0, 10),
    order: t.order,
    jiraCode: t.jiraCode,
    jiraLink: t.jiraLink,
    assignees: t.assignees.map((a) => ({
      id: a.id,
      memberId: a.memberId,
      memberName: a.member.name,
      weekAllocations: Object.fromEntries(
        a.weekAllocations.map((w) => [`${w.year}-${w.week}`, Number(w.days)])
      ),
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
    <ProjectDetailClient
      project={dto}
      logs={logs}
      assignments={assignments}
      budgetItems={budgetItems}
      financials={financials}
      invoices={invoices}
      tasks={tasks}
      rates={ratesDto}
      isAdmin={isAdmin}
      isSuperAdmin={isSuperAdmin}
      factories={factories.map((f) => ({ id: f.id, name: f.name, location: f.location }))}
      members={members.map((m) => ({ id: m.id, name: m.name, title: m.title }))}
    />
  );
}
