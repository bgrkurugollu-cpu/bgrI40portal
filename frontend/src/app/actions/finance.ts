"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { BudgetExpenseType, Currency, InvoiceStatus } from "@prisma/client";

// Gelir en az giderin %5 fazlası olmalıdır (taban değer); üzeri manuel girilebilir.
const INCOME_MARKUP = 1.05;

export async function upsertMonthlyFinancial(input: {
  projectId: string;
  year: number;
  month: number;
  expense: number;
  income?: number;
  internalIncome: number;
  currency: Currency;
}) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");

  // Gelir en az gider*%5 olmalı; kullanıcı bunun üzerinde bir değer girmişse o kullanılır.
  const minIncome = Math.round(input.expense * INCOME_MARKUP * 100) / 100;
  const income = Math.max(input.income ?? minIncome, minIncome);

  const data = {
    projectId: input.projectId,
    year: input.year,
    month: input.month,
    expense: input.expense,
    income,
    internalIncome: input.internalIncome,
    currency: input.currency,
  };

  await prisma.monthlyFinancial.upsert({
    where: {
      projectId_year_month: {
        projectId: input.projectId,
        year: input.year,
        month: input.month,
      },
    },
    create: data,
    update: {
      expense: data.expense,
      income: data.income,
      internalIncome: data.internalIncome,
      currency: data.currency,
    },
  });
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath("/finance");
  revalidatePath("/");
}

export async function addBudgetItem(input: {
  projectId: string;
  year: number;
  expenseType: BudgetExpenseType;
  category: string;
  description: string;
  supplier?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  currency: Currency;
  note?: string;
  transferFeePercent?: number;
}) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");

  // Toplam Maliyet = Miktar × Birim Fiyat; TF Fiyatı = Toplam Maliyet × (1 + TF%/100).
  const amount = input.quantity * input.unitPrice;
  const transferPrice = amount * (1 + (input.transferFeePercent ?? 0) / 100);

  await prisma.budgetItem.create({
    data: { ...input, amount, transferPrice },
  });
  revalidatePath(`/projects/${input.projectId}`);
}

export async function deleteBudgetItem(id: string, projectId: string) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");
  await prisma.budgetItem.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}`);
}

export type ImportedBudgetItem = {
  expenseType: BudgetExpenseType;
  category: string;
  description: string;
  supplier?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  currency: Currency;
  note?: string;
  transferFeePercent?: number;
  transferPrice?: number;
  year: number;
};

export async function importBudgetItemsForProject(
  projectId: string,
  items: ImportedBudgetItem[]
) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");

  await prisma.budgetItem.createMany({
    data: items.map((it) => ({
      projectId,
      year: it.year,
      expenseType: it.expenseType,
      category: it.category,
      description: it.description,
      supplier: it.supplier,
      unit: it.unit,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      amount: it.quantity * it.unitPrice,
      currency: it.currency,
      note: it.note,
      transferFeePercent: it.transferFeePercent,
      transferPrice: it.transferPrice,
    })),
  });
  revalidatePath(`/projects/${projectId}`);
  return { inserted: items.length };
}

export async function addInvoice(input: {
  projectId: string;
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
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");

  await prisma.invoice.create({
    data: { ...input, issueDate: new Date(input.issueDate) },
  });
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath("/finance");
}

export async function updateInvoice(
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
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");

  const inv = await prisma.invoice.update({
    where: { id },
    data: { ...input, issueDate: new Date(input.issueDate) },
  });
  revalidatePath(`/projects/${inv.projectId}`);
  revalidatePath("/finance");
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");
  const inv = await prisma.invoice.update({ where: { id }, data: { status } });
  revalidatePath(`/projects/${inv.projectId}`);
  revalidatePath("/finance");
}

export async function deleteInvoice(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");
  const inv = await prisma.invoice.delete({ where: { id } });
  revalidatePath(`/projects/${inv.projectId}`);
  revalidatePath("/finance");
}
