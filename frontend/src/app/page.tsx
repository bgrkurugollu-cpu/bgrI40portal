import { prisma } from "@/lib/db";
import { getRates, toTRY } from "@/lib/rates";
import type { CurrencyCode } from "@/lib/utils";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const year = new Date().getFullYear();

  const [rates, projects, financials, assignments, licenses, invoices, memberCount, ptFinancials, ptInvoices] =
    await Promise.all([
      getRates(),
      prisma.project.findMany({ include: { factories: true } }),
      prisma.monthlyFinancial.findMany({ where: { year }, include: { project: true } }),
      prisma.assignment.findMany({ where: { year } }),
      prisma.license.findMany(),
      prisma.invoice.findMany({
        include: { project: true },
        where: { status: "PLANNED" },
        orderBy: { issueDate: "asc" },
        take: 6,
      }),
      prisma.teamMember.count({ where: { active: true } }),
      prisma.ptMonthlyFinancial.findMany({ where: { year }, include: { pt: true } }),
      prisma.ptInvoice.findMany({
        include: { pt: true },
        where: { status: "PLANNED" },
        orderBy: { issueDate: "asc" },
        take: 6,
      }),
    ]);

  // Tüm finansal toplamlar TL karşılığı üzerinden hesaplanır (PT'ler dahil).
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const rows = financials.filter((f) => f.month === i + 1);
    const ptRows = ptFinancials.filter((f) => f.month === i + 1);
    return {
      month: i + 1,
      income:
        rows.reduce((s, f) => s + toTRY(Number(f.income), f.currency as CurrencyCode, rates), 0) +
        ptRows.reduce((s, f) => s + toTRY(Number(f.income), f.currency as CurrencyCode, rates), 0),
      expense:
        rows.reduce((s, f) => s + toTRY(Number(f.expense), f.currency as CurrencyCode, rates), 0) +
        ptRows.reduce((s, f) => s + toTRY(Number(f.expense), f.currency as CurrencyCode, rates), 0),
      internal: rows.reduce(
        (s, f) => s + toTRY(Number(f.internalIncome), f.currency as CurrencyCode, rates),
        0
      ),
    };
  });

  // Proje bazlı aylık finansallar (TL) — nakit akışı anomalilerinde kök neden için.
  const financialsByProject = [
    ...financials.map((f) => ({
      projectId: f.projectId,
      projectCode: f.project.projectCode,
      projectName: f.project.name,
      month: f.month,
      incomeTRY: toTRY(Number(f.income), f.currency as CurrencyCode, rates),
      expenseTRY: toTRY(Number(f.expense), f.currency as CurrencyCode, rates),
      internalIncomeTRY: toTRY(Number(f.internalIncome), f.currency as CurrencyCode, rates),
    })),
    ...ptFinancials.map((f) => ({
      projectId: f.ptId,
      projectCode: f.pt.ptCode,
      projectName: f.pt.name,
      month: f.month,
      incomeTRY: toTRY(Number(f.income), f.currency as CurrencyCode, rates),
      expenseTRY: toTRY(Number(f.expense), f.currency as CurrencyCode, rates),
      internalIncomeTRY: 0,
    })),
  ];

  const effort = Array.from({ length: 12 }, (_, i) => {
    const rows = assignments.filter((a) => a.month === i + 1);
    return {
      month: i + 1,
      planned: rows.reduce((s, a) => s + Number(a.plannedDays), 0),
      actual: rows.reduce((s, a) => s + Number(a.actualDays), 0),
    };
  });

  return (
    <DashboardClient
      year={year}
      stats={{
        activeProjects: projects.filter((p) => p.status === "ACTIVE").length,
        totalProjects: projects.length,
        totalBudget: projects.reduce((s, p) => s + Number(p.targetBudget), 0),
        teamSize: memberCount,
        licenseCount: licenses.length,
        licenseInvestment: licenses.reduce(
          (s, l) => s + toTRY(Number(l.totalInvestment), l.currency as CurrencyCode, rates),
          0
        ),
        highRisk: projects.filter(
          (p) => p.riskLevel === "HIGH" || p.riskLevel === "CRITICAL"
        ).length,
      }}
      monthly={monthly}
      financialsByProject={financialsByProject}
      effort={effort}
      upcomingInvoices={[
        ...invoices.map((i) => ({
          id: i.id,
          projectId: i.projectId,
          projectCode: i.project.projectCode,
          projectName: i.project.name,
          description: i.description,
          amount: Number(i.amount),
          currency: i.currency as CurrencyCode,
          amountTRY: toTRY(Number(i.amount), i.currency as CurrencyCode, rates),
          issueDate: i.issueDate.toISOString().slice(0, 10),
          status: i.status,
          ebaNumber: i.ebaNumber,
          poNumber: i.poNumber,
          source: undefined as "PT" | undefined,
        })),
        ...ptInvoices.map((i) => ({
          id: i.id,
          projectId: i.ptId,
          projectCode: i.pt.ptCode,
          projectName: i.pt.name,
          description: i.description,
          amount: Number(i.amount),
          currency: i.currency as CurrencyCode,
          amountTRY: toTRY(Number(i.amount), i.currency as CurrencyCode, rates),
          issueDate: i.issueDate.toISOString().slice(0, 10),
          status: i.status,
          ebaNumber: i.ebaNumber,
          poNumber: i.poNumber,
          source: "PT" as const,
        })),
      ]
        .sort((a, b) => a.issueDate.localeCompare(b.issueDate))
        .slice(0, 6)}
    />
  );
}
