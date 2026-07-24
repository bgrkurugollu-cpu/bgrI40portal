import { prisma } from "@/lib/db";
import type { FinancialDTO, InvoiceDTO, RatesDTO } from "@/lib/types";
import { getRates, toTRY } from "@/lib/rates";
import type { CurrencyCode } from "@/lib/utils";
import { FinanceClient } from "./finance-client";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const [rates, financials, invoices, projects] = await Promise.all([
    getRates(),
    prisma.monthlyFinancial.findMany({
      // Yalnızca DTO alanları — payload'ı küçük tutar.
      select: {
        id: true,
        projectId: true,
        year: true,
        month: true,
        income: true,
        expense: true,
        internalIncome: true,
        currency: true,
        project: { select: { name: true, projectCode: true } },
      },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    }),
    prisma.invoice.findMany({
      select: {
        id: true,
        projectId: true,
        description: true,
        amount: true,
        currency: true,
        issueDate: true,
        status: true,
        ebaNumber: true,
        poNumber: true,
        project: { select: { name: true, projectCode: true } },
      },
      orderBy: { issueDate: "asc" },
    }),
    prisma.project.findMany({ select: { id: true, name: true, projectCode: true } }),
  ]);

  const finDtos: (FinancialDTO & { projectName: string })[] = financials.map((f) => {
    const currency = f.currency as CurrencyCode;
    return {
      id: f.id,
      projectId: f.projectId,
      projectCode: f.project.projectCode,
      projectName: f.project.name,
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

  const invDtos: InvoiceDTO[] = invoices.map((i) => {
    const currency = i.currency as CurrencyCode;
    return {
      id: i.id,
      projectId: i.projectId,
      projectCode: i.project.projectCode,
      projectName: i.project.name,
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
    <FinanceClient
      financials={finDtos}
      invoices={invDtos}
      projects={projects}
      rates={ratesDto}
    />
  );
}
