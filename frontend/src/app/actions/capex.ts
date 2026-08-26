"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { Currency } from "@prisma/client";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    throw new Error("Yetkisiz — CAPEX bütçesi düzenlemesi yalnızca admin tarafından yapılabilir.");
  return session;
}

// ── Yıllık Bütçe Kabı ────────────────────────────────────

export async function upsertCapexBudget(input: {
  year: number;
  currency: Currency;
  title?: string | null;
  totalBudget: number;
}) {
  await requireAdmin();
  await prisma.capexBudget.upsert({
    where: { year: input.year },
    create: input,
    update: {
      currency: input.currency,
      title: input.title,
      totalBudget: input.totalBudget,
    },
  });
  revalidatePath("/capex");
}

export async function deleteCapexBudget(id: string) {
  await requireAdmin();
  await prisma.capexBudget.delete({ where: { id } }); // ana kalemler/alt kalemler cascade silinir
  revalidatePath("/capex");
}

// ── Ana Kalem ────────────────────────────────────────────

export async function addMainItem(input: {
  capexBudgetId: string;
  title: string;
  budget: number;
  spent?: number;
  description?: string | null;
  factoryIds: string[];
  order?: number;
}) {
  await requireAdmin();
  const { factoryIds, ...rest } = input;
  await prisma.capexMainItem.create({
    data: {
      ...rest,
      factories: { connect: factoryIds.map((id) => ({ id })) },
    },
  });
  revalidatePath("/capex");
}

export async function updateMainItem(
  id: string,
  input: {
    title: string;
    budget: number;
    spent: number;
    description?: string | null;
    factoryIds: string[];
  }
) {
  await requireAdmin();
  const { factoryIds, ...rest } = input;
  await prisma.capexMainItem.update({
    where: { id },
    data: {
      ...rest,
      factories: { set: factoryIds.map((fid) => ({ id: fid })) },
    },
  });
  revalidatePath("/capex");
}

export async function deleteMainItem(id: string) {
  await requireAdmin();
  await prisma.capexMainItem.delete({ where: { id } }); // alt kalemler cascade silinir
  revalidatePath("/capex");
}

// ── Alt Kalem (Proje) ────────────────────────────────────

export async function addSubItem(input: {
  mainItemId: string;
  title: string;
  budget: number;
  note?: string | null;
  order?: number;
}) {
  await requireAdmin();
  await prisma.capexSubItem.create({ data: input });
  revalidatePath("/capex");
}

export async function updateSubItem(
  id: string,
  input: { title: string; budget: number; note?: string | null }
) {
  await requireAdmin();
  await prisma.capexSubItem.update({ where: { id }, data: input });
  revalidatePath("/capex");
}

export async function deleteSubItem(id: string) {
  await requireAdmin();
  await prisma.capexSubItem.delete({ where: { id } });
  revalidatePath("/capex");
}
