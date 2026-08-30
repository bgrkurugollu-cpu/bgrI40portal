"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePageEdit } from "@/lib/permission-guard";
import { getRates, toTRY } from "@/lib/rates";
import type { Currency } from "@prisma/client";

function requireAdmin() {
  return requirePageEdit("capex");
}

// Bir alt kalem bir Proje'ye bağlıysa, alt kalemin bütçesini (CAPEX bütçesinin
// para biriminde) güncel TCMB kuruyla TL'ye çevirip projenin targetBudget
// alanına yazar ve bunu ProjectLog'a "targetBudget" alanı olarak işler —
// böylece proje sayfasındaki tarihsel değişiklik logunda da görünür.
async function syncProjectTargetBudgetFromCapex(
  projectId: string,
  amountInBudgetCurrency: number,
  currency: Currency,
  actingUserId: string
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { targetBudget: true },
  });
  if (!project) return;

  const rates = await getRates();
  const converted = toTRY(amountInBudgetCurrency, currency, rates);
  const oldValue = Number(project.targetBudget);
  const newValue = Math.round(converted * 100) / 100;
  if (oldValue === newValue) return;

  await prisma.project.update({ where: { id: projectId }, data: { targetBudget: newValue } });
  await prisma.projectLog.create({
    data: {
      projectId,
      userId: actingUserId,
      field: "targetBudget",
      oldValue: String(oldValue),
      newValue: String(newValue),
    },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
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
  projectId?: string | null;
  title: string;
  budget: number;
  note?: string | null;
  order?: number;
}) {
  const session = await requireAdmin();
  const { projectId, ...rest } = input;
  const subItem = await prisma.capexSubItem.create({
    data: { ...rest, projectId: projectId || null },
    include: { mainItem: { include: { capexBudget: true } } },
  });
  if (projectId) {
    await syncProjectTargetBudgetFromCapex(
      projectId,
      input.budget,
      subItem.mainItem.capexBudget.currency,
      session.sub
    );
  }
  revalidatePath("/capex");
}

export async function updateSubItem(
  id: string,
  input: { projectId?: string | null; title: string; budget: number; note?: string | null }
) {
  const session = await requireAdmin();
  const { projectId, ...rest } = input;
  const subItem = await prisma.capexSubItem.update({
    where: { id },
    data: { ...rest, projectId: projectId || null },
    include: { mainItem: { include: { capexBudget: true } } },
  });
  if (projectId) {
    await syncProjectTargetBudgetFromCapex(
      projectId,
      input.budget,
      subItem.mainItem.capexBudget.currency,
      session.sub
    );
  }
  revalidatePath("/capex");
}

export async function deleteSubItem(id: string) {
  await requireAdmin();
  await prisma.capexSubItem.delete({ where: { id } });
  revalidatePath("/capex");
}
