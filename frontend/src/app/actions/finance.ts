"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { Currency, InvoiceStatus } from "@prisma/client";

// Gelir her zaman giderin %5 fazlasıdır (dış faturaya konan marj).
const INCOME_MARKUP = 1.05;

export async function upsertMonthlyFinancial(input: {
  projectId: string;
  year: number;
  month: number;
  expense: number;
  internalIncome: number;
  currency: Currency;
}) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");

  // Gelir gider üzerinden türetilir; manuel gelir girişi alınmaz.
  const income = Math.round(input.expense * INCOME_MARKUP * 100) / 100;

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
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
  currency: Currency;
}) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");

  await prisma.budgetItem.create({
    data: { ...input, amount: input.quantity * input.unitPrice },
  });
  revalidatePath(`/projects/${input.projectId}`);
}

export async function deleteBudgetItem(id: string, projectId: string) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");
  await prisma.budgetItem.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}`);
}

export async function addInvoice(input: {
  projectId: string;
  description: string;
  amount: number;
  currency: Currency;
  issueDate: string;
  status: InvoiceStatus;
}) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");

  await prisma.invoice.create({
    data: { ...input, issueDate: new Date(input.issueDate) },
  });
  revalidatePath(`/projects/${input.projectId}`);
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
