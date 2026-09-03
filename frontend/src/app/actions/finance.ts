"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePageEdit } from "@/lib/permission-guard";
import { getSession } from "@/lib/auth";
import { getRates, toTRY } from "@/lib/rates";
import type { BudgetExpenseType, Currency, InvoiceStatus, InvoiceType } from "@prisma/client";

// Bütçe kırılımı yalnızca gerçek ADMIN rolüne sahip kullanıcılarca düzenlenebilir
// (sayfa bazlı "projects" düzenleme izninden bağımsız, daha kısıtlı bir kural).
async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Yetkisiz — bu alanı yalnızca admin düzenleyebilir.");
  return session;
}

// Bir proje + yıl + ay için Gider/Gelir/İç Kaynak Geliri alanlarını, o aya ait
// tüm faturaların (tipine göre) TL karşılığı toplamından yeniden hesaplar.
// Üçü de artık faturadan türetilir — elle girilen bir alan kalmadı.
async function recomputeMonthlyFinancialFromInvoices(projectId: string, year: number, month: number) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const invoices = await prisma.invoice.findMany({
    where: { projectId, issueDate: { gte: monthStart, lt: monthEnd } },
  });
  const rates = await getRates();
  let income = 0;
  let expense = 0;
  let internalIncome = 0;
  for (const inv of invoices) {
    const tl = toTRY(Number(inv.amount), inv.currency as Currency, rates);
    if (inv.type === "INCOME") income += tl;
    else if (inv.type === "INTERNAL") internalIncome += tl;
    else expense += tl;
  }
  income = Math.round(income * 100) / 100;
  expense = Math.round(expense * 100) / 100;
  internalIncome = Math.round(internalIncome * 100) / 100;

  await prisma.monthlyFinancial.upsert({
    where: { projectId_year_month: { projectId, year, month } },
    create: { projectId, year, month, income, expense, internalIncome, currency: "TRY" },
    update: { income, expense, internalIncome, currency: "TRY" },
  });
  revalidatePath(`/projects/${projectId}`);
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
  await requireAdmin();

  // Toplam Maliyet = Miktar × Birim Fiyat; TF Fiyatı = Toplam Maliyet × (1 + TF%/100).
  const amount = input.quantity * input.unitPrice;
  const transferPrice = amount * (1 + (input.transferFeePercent ?? 0) / 100);

  await prisma.budgetItem.create({
    data: { ...input, amount, transferPrice },
  });
  revalidatePath(`/projects/${input.projectId}`);
}

export async function updateBudgetItem(
  id: string,
  input: {
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
  }
) {
  await requireAdmin();

  const amount = input.quantity * input.unitPrice;
  const transferPrice = amount * (1 + (input.transferFeePercent ?? 0) / 100);

  const item = await prisma.budgetItem.update({
    where: { id },
    data: { ...input, amount, transferPrice },
  });
  revalidatePath(`/projects/${item.projectId}`);
}

export async function deleteBudgetItem(id: string, projectId: string) {
  await requireAdmin();
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
  await requireAdmin();

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

async function monthOf(date: Date) {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export async function addInvoice(input: {
  projectId: string;
  type: InvoiceType;
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
  await requirePageEdit("projects");

  const inv = await prisma.invoice.create({
    data: { ...input, issueDate: new Date(input.issueDate) },
  });
  const { year, month } = await monthOf(inv.issueDate);
  await recomputeMonthlyFinancialFromInvoices(inv.projectId, year, month);
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath("/finance");
}

export async function updateInvoice(
  id: string,
  input: {
    type: InvoiceType;
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
  await requirePageEdit("projects");

  const before = await prisma.invoice.findUniqueOrThrow({ where: { id } });
  const inv = await prisma.invoice.update({
    where: { id },
    data: { ...input, issueDate: new Date(input.issueDate) },
  });
  const oldMonth = await monthOf(before.issueDate);
  const newMonth = await monthOf(inv.issueDate);
  await recomputeMonthlyFinancialFromInvoices(inv.projectId, oldMonth.year, oldMonth.month);
  if (oldMonth.year !== newMonth.year || oldMonth.month !== newMonth.month) {
    await recomputeMonthlyFinancialFromInvoices(inv.projectId, newMonth.year, newMonth.month);
  }
  revalidatePath(`/projects/${inv.projectId}`);
  revalidatePath("/finance");
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
  await requirePageEdit("projects");
  const inv = await prisma.invoice.update({ where: { id }, data: { status } });
  revalidatePath(`/projects/${inv.projectId}`);
  revalidatePath("/finance");
}

export async function deleteInvoice(id: string) {
  await requirePageEdit("projects");
  const inv = await prisma.invoice.delete({ where: { id } });
  const { year, month } = await monthOf(inv.issueDate);
  await recomputeMonthlyFinancialFromInvoices(inv.projectId, year, month);
  revalidatePath(`/projects/${inv.projectId}`);
  revalidatePath("/finance");
}

// ── Ödeme Planı (Milestone bazlı) ────────────────────────

export async function addPaymentMilestone(projectId: string) {
  await requirePageEdit("projects");
  const count = await prisma.paymentMilestone.count({ where: { projectId } });
  await prisma.paymentMilestone.create({
    data: { projectId, order: count, label: `Milestone ${count + 1}`, percentage: 0 },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function updatePaymentMilestone(
  id: string,
  input: { label: string; percentage: number }
) {
  await requirePageEdit("projects");
  const m = await prisma.paymentMilestone.update({ where: { id }, data: input });
  revalidatePath(`/projects/${m.projectId}`);
}

export async function deletePaymentMilestone(id: string) {
  await requirePageEdit("projects");
  const m = await prisma.paymentMilestone.delete({ where: { id } });
  revalidatePath(`/projects/${m.projectId}`);
}
