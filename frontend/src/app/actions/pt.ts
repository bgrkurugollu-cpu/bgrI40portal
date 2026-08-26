"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePageEdit } from "@/lib/permission-guard";
import type { Currency, InvoiceStatus, ProjectStatus } from "@prisma/client";

// Gelir en az giderin %5 fazlası olmalıdır (taban değer); üzeri manuel girilebilir.
const INCOME_MARKUP = 1.05;

export async function createPt(input: {
  ptCode: string;
  pipelineCode?: string | null;
  name: string;
  description?: string | null;
  status: ProjectStatus;
}) {
  await requirePageEdit("pt");

  const pt = await prisma.pt.create({ data: input });
  revalidatePath("/pt");
  return { id: pt.id };
}

export async function updatePt(
  id: string,
  input: {
    ptCode: string;
    pipelineCode?: string | null;
    name: string;
    description?: string | null;
    status: ProjectStatus;
  }
) {
  await requirePageEdit("pt");

  await prisma.pt.update({ where: { id }, data: input });
  revalidatePath(`/pt/${id}`);
  revalidatePath("/pt");
}

export async function deletePt(id: string) {
  await requirePageEdit("pt");
  // İlişkili faturalar ve aylık finans kayıtları şemada onDelete: Cascade olduğundan otomatik silinir.
  await prisma.pt.delete({ where: { id } });
  revalidatePath("/pt");
}

// ── PT Faturaları ────────────────────────────────────────

export async function addPtInvoice(input: {
  ptId: string;
  description: string;
  amount: number;
  currency: Currency;
  issueDate: string;
  status: InvoiceStatus;
  ebaNumber: string;
  poNumber?: string;
  hasExchangeRateDiff?: boolean;
  exchangeRateDiffEbaNumber?: string;
}) {
  await requirePageEdit("pt");

  await prisma.ptInvoice.create({
    data: { ...input, issueDate: new Date(input.issueDate) },
  });
  revalidatePath(`/pt/${input.ptId}`);
}

export async function updatePtInvoice(
  id: string,
  input: {
    description: string;
    amount: number;
    currency: Currency;
    issueDate: string;
    status: InvoiceStatus;
    ebaNumber: string;
    poNumber?: string;
    hasExchangeRateDiff?: boolean;
    exchangeRateDiffEbaNumber?: string;
  }
) {
  await requirePageEdit("pt");

  const inv = await prisma.ptInvoice.update({
    where: { id },
    data: { ...input, issueDate: new Date(input.issueDate) },
  });
  revalidatePath(`/pt/${inv.ptId}`);
}

export async function updatePtInvoiceStatus(id: string, status: InvoiceStatus) {
  await requirePageEdit("pt");
  const inv = await prisma.ptInvoice.update({ where: { id }, data: { status } });
  revalidatePath(`/pt/${inv.ptId}`);
}

export async function deletePtInvoice(id: string) {
  await requirePageEdit("pt");
  const inv = await prisma.ptInvoice.delete({ where: { id } });
  revalidatePath(`/pt/${inv.ptId}`);
}

// ── PT Aylık Finans ──────────────────────────────────────

export async function upsertPtMonthlyFinancial(input: {
  ptId: string;
  year: number;
  month: number;
  expense: number;
  income?: number;
  currency: Currency;
}) {
  await requirePageEdit("pt");

  const minIncome = Math.round(input.expense * INCOME_MARKUP * 100) / 100;
  const income = Math.max(input.income ?? minIncome, minIncome);

  const data = {
    ptId: input.ptId,
    year: input.year,
    month: input.month,
    expense: input.expense,
    income,
    currency: input.currency,
  };

  await prisma.ptMonthlyFinancial.upsert({
    where: {
      ptId_year_month: {
        ptId: input.ptId,
        year: input.year,
        month: input.month,
      },
    },
    create: data,
    update: {
      expense: data.expense,
      income: data.income,
      currency: data.currency,
    },
  });
  revalidatePath(`/pt/${input.ptId}`);
}
