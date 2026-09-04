import { prisma } from "@/lib/db";
import { getRates, toTRY } from "@/lib/rates";
import type { CurrencyCode } from "@/lib/utils";
import { requirePageView } from "@/lib/permission-guard";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePageView("dashboard");
  const year = new Date().getFullYear();

  const [rates, projects, financials, assignments, licenses, invoices, memberCount] =
    await Promise.all([
      getRates(),
      prisma.project.findMany({ where: { kind: "PROJECT" }, include: { factories: true } }),
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
    ]);

  // Tüm finansal toplamlar TL karşılığı üzerinden hesaplanır. `financials` kind'a göre
  // filtrelenmez — Proje ve Lead/CR'ın gerçekleşen gelir/gideri burada birlikte toplanır.
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const rows = financials.filter((f) => f.month === i + 1);
    return {
      month: i + 1,
      income: rows.reduce((s, f) => s + toTRY(Number(f.income), f.currency as CurrencyCode, rates), 0),
      expense: rows.reduce((s, f) => s + toTRY(Number(f.expense), f.currency as CurrencyCode, rates), 0),
      internal: rows.reduce(
        (s, f) => s + toTRY(Number(f.internalIncome), f.currency as CurrencyCode, rates),
        0
      ),
    };
  });

  // Ciro (Gelir + İç Kaynak Geliri) — Bütçe & Finans sayfasıyla birebir aynı mantık.
  const totalCiro = monthly.reduce((s, m) => s + m.income + m.internal, 0);

  // Proje bazlı aylık finansallar (TL) — nakit akışı anomalilerinde kök neden için.
  const financialsByProject = financials.map((f) => ({
    projectId: f.projectId,
    projectCode: f.project.projectCode,
    projectName: f.project.name,
    month: f.month,
    incomeTRY: toTRY(Number(f.income), f.currency as CurrencyCode, rates),
    expenseTRY: toTRY(Number(f.expense), f.currency as CurrencyCode, rates),
    internalIncomeTRY: toTRY(Number(f.internalIncome), f.currency as CurrencyCode, rates),
  }));

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
        totalCiro,
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
      upcomingInvoices={invoices
        .map((i) => ({
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
        }))
        .sort((a, b) => a.issueDate.localeCompare(b.issueDate))
        .slice(0, 6)}
    />
  );
}
