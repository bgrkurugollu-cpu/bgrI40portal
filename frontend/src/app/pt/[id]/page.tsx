import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import type { PtDTO, PtInvoiceDTO, PtMonthlyFinancialDTO, RatesDTO } from "@/lib/types";
import { getRates, toTRY } from "@/lib/rates";
import type { CurrencyCode } from "@/lib/utils";
import { requirePageView } from "@/lib/permission-guard";
import { PtDetailClient } from "./detail-client";

export const dynamic = "force-dynamic";

export default async function PtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageView("pt");

  const [pt, rates] = await Promise.all([
    prisma.pt.findUnique({
      where: { id },
      include: {
        invoices: { orderBy: { issueDate: "asc" } },
        financials: { orderBy: [{ year: "asc" }, { month: "asc" }] },
      },
    }),
    getRates(),
  ]);
  if (!pt) notFound();

  const dto: PtDTO = {
    id: pt.id,
    ptCode: pt.ptCode,
    pipelineCode: pt.pipelineCode,
    name: pt.name,
    description: pt.description,
    status: pt.status,
  };

  const invoices: PtInvoiceDTO[] = pt.invoices.map((i) => {
    const currency = i.currency as CurrencyCode;
    return {
      id: i.id,
      ptId: i.ptId,
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

  const financials: PtMonthlyFinancialDTO[] = pt.financials.map((f) => {
    const currency = f.currency as CurrencyCode;
    return {
      id: f.id,
      ptId: f.ptId,
      year: f.year,
      month: f.month,
      income: Number(f.income),
      expense: Number(f.expense),
      currency,
      incomeTRY: toTRY(Number(f.income), currency, rates),
      expenseTRY: toTRY(Number(f.expense), currency, rates),
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
    <PtDetailClient pt={dto} invoices={invoices} financials={financials} rates={ratesDto} />
  );
}
