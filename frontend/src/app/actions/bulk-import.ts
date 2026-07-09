"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  importFactories,
  importMembers,
  importApplications,
  importProjects,
  importAssignments,
  importBudgetItems,
  importFinancials,
  importLicenses,
  importInvoices,
  type BulkResult,
  type RawRow,
} from "@/lib/bulk-import-core";

export type { BulkResult } from "@/lib/bulk-import-core";

// ── Ortak ───────────────────────────────────────────────

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Yetkisiz");
  return session;
}

// ── Server Action sarmalayıcıları ───────────────────────
// İş mantığı @/lib/bulk-import-core içindedir (seed script ile paylaşılır).
// Buradaki her fonksiyon yetki kontrolü + ilgili sayfaların revalidate'ini ekler.

export async function bulkImportFactories(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result = await importFactories(prisma, rows);
  revalidatePath("/admin");
  return result;
}

export async function bulkImportMembers(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result = await importMembers(prisma, rows);
  revalidatePath("/admin");
  revalidatePath("/resources");
  return result;
}

export async function bulkImportApplications(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result = await importApplications(prisma, rows);
  revalidatePath("/admin");
  revalidatePath("/licenses");
  return result;
}

export async function bulkImportProjects(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result = await importProjects(prisma, rows);
  revalidatePath("/projects");
  revalidatePath("/");
  return result;
}

export async function bulkImportAssignments(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result = await importAssignments(prisma, rows);
  revalidatePath("/resources");
  return result;
}

export async function bulkImportBudgetItems(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result = await importBudgetItems(prisma, rows);
  revalidatePath("/");
  return result;
}

export async function bulkImportFinancials(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result = await importFinancials(prisma, rows);
  revalidatePath("/finance");
  revalidatePath("/");
  return result;
}

export async function bulkImportLicenses(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result = await importLicenses(prisma, rows);
  revalidatePath("/licenses");
  revalidatePath("/admin");
  return result;
}

export async function bulkImportInvoices(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result = await importInvoices(prisma, rows);
  revalidatePath("/finance");
  revalidatePath("/");
  return result;
}
