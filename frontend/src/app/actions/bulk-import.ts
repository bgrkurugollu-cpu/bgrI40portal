"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { Currency, LicenseStatus, PaymentPeriod, Priority, ProjectStatus, RiskLevel } from "@prisma/client";

// ── Ortak ───────────────────────────────────────────────

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Yetkisiz");
  return session;
}

export type BulkResult = {
  ok: boolean;
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

type RawRow = Record<string, string | number | null>;

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ── Fabrikalar ──────────────────────────────────────────

export async function bulkImportFactories(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result: BulkResult = { ok: true, inserted: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = str(r["Ad"]);
    if (!name) {
      result.errors.push({ row: i + 1, message: "Ad boş bırakılamaz." });
      continue;
    }
    const exists = await prisma.factory.findUnique({ where: { name } });
    if (exists) {
      result.skipped++;
      continue;
    }
    try {
      await prisma.factory.create({
        data: { name, location: str(r["Lokasyon"]) || null },
      });
      result.inserted++;
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  revalidatePath("/admin");
  return result;
}

// ── Ekip Üyeleri ────────────────────────────────────────

export async function bulkImportMembers(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result: BulkResult = { ok: true, inserted: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = str(r["Ad Soyad"]);
    if (!name) {
      result.errors.push({ row: i + 1, message: "Ad Soyad boş bırakılamaz." });
      continue;
    }
    // İsimle kontrol (tam eşleşme)
    const exists = await prisma.teamMember.findFirst({ where: { name } });
    if (exists) {
      result.skipped++;
      continue;
    }
    const activeStr = str(r["Aktif"]).toLowerCase();
    const active = activeStr !== "hayır" && activeStr !== "hayir" && activeStr !== "no" && activeStr !== "false" && activeStr !== "0";
    try {
      await prisma.teamMember.create({
        data: { name, title: str(r["Ünvan"]) || null, active },
      });
      result.inserted++;
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/resources");
  return result;
}

// ── Uygulamalar ─────────────────────────────────────────

export async function bulkImportApplications(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result: BulkResult = { ok: true, inserted: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = str(r["Uygulama Adı"]);
    if (!name) {
      result.errors.push({ row: i + 1, message: "Uygulama Adı boş bırakılamaz." });
      continue;
    }
    const exists = await prisma.application.findUnique({ where: { name } });
    if (exists) {
      result.skipped++;
      continue;
    }
    try {
      await prisma.application.create({
        data: { name, vendor: str(r["Üretici"]) || null },
      });
      result.inserted++;
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/licenses");
  return result;
}

// ── Projeler ────────────────────────────────────────────

const VALID_RISKS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const VALID_PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const VALID_STATUSES: ProjectStatus[] = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];
const VALID_CURRENCIES: Currency[] = ["TRY", "USD", "EUR", "GBP"];

export async function bulkImportProjects(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result: BulkResult = { ok: true, inserted: 0, skipped: 0, errors: [] };

  // Fabrika isim → ID haritası
  const factories = await prisma.factory.findMany();
  const factoryMap = new Map(factories.map((f) => [f.name, f.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const projectCode = str(r["Proje Kodu"]);
    if (!projectCode) {
      result.errors.push({ row: i + 1, message: "Proje Kodu boş bırakılamaz." });
      continue;
    }
    const name = str(r["Proje İsmi"]);
    if (!name) {
      result.errors.push({ row: i + 1, message: "Proje İsmi boş bırakılamaz." });
      continue;
    }

    const factoryName = str(r["Fabrika"]);
    const factoryId = factoryMap.get(factoryName);
    if (!factoryId) {
      result.errors.push({
        row: i + 1,
        message: `"${factoryName}" isimli fabrika bulunamadı. Önce fabrikaları yükleyin.`,
      });
      continue;
    }

    // Aynı kod veya isimde proje var mı kontrolü
    const exists = await prisma.project.findFirst({
      where: { OR: [{ projectCode }, { name }] },
    });
    if (exists) {
      result.skipped++;
      continue;
    }

    const risk = str(r["Risk"]).toUpperCase() as RiskLevel;
    const priority = str(r["Öncelik"]).toUpperCase() as Priority;
    const status = str(r["Durum"]).toUpperCase() as ProjectStatus;

    if (risk && !VALID_RISKS.includes(risk)) {
      result.errors.push({ row: i + 1, message: `Geçersiz risk seviyesi: "${risk}". Geçerli: ${VALID_RISKS.join(", ")}` });
      continue;
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      result.errors.push({ row: i + 1, message: `Geçersiz öncelik: "${priority}". Geçerli: ${VALID_PRIORITIES.join(", ")}` });
      continue;
    }
    if (status && !VALID_STATUSES.includes(status)) {
      result.errors.push({ row: i + 1, message: `Geçersiz durum: "${status}". Geçerli: ${VALID_STATUSES.join(", ")}` });
      continue;
    }

    const startDate = str(r["Başlangıç"]);
    const endDate = str(r["Bitiş"]);

    try {
      await prisma.project.create({
        data: {
          projectCode,
          name,
          factoryId,
          probability: num(r["İhtimal(%)"]) || 50,
          targetBudget: num(r["Hedef Bütçe"]),
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          riskLevel: risk || "MEDIUM",
          priority: priority || "MEDIUM",
          status: status || "PLANNED",
          description: str(r["Açıklama"]) || null,
        },
      });
      result.inserted++;
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  revalidatePath("/projects");
  revalidatePath("/");
  return result;
}

// ── Kaynak Planı (Assignments) ──────────────────────────

export async function bulkImportAssignments(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result: BulkResult = { ok: true, inserted: 0, skipped: 0, errors: [] };

  const projects = await prisma.project.findMany();
  const projectCodeMap = new Map(projects.map((p) => [p.projectCode, p.id]));
  const projectNameMap = new Map(projects.map((p) => [p.name, p.id]));

  const members = await prisma.teamMember.findMany();
  const memberMap = new Map(members.map((m) => [m.name, m.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    
    const pCode = str(r["Proje Kodu"]);
    const projectName = str(r["Proje"]);
    const projectId = projectCodeMap.get(pCode) || projectNameMap.get(projectName);
    
    if (!projectId) {
      result.errors.push({
        row: i + 1,
        message: `Proje bulunamadı (Kod: ${pCode}, İsim: ${projectName}).`,
      });
      continue;
    }

    const memberName = str(r["Ekip Üyesi"]);
    const memberId = memberMap.get(memberName);
    if (!memberId) {
      result.errors.push({
        row: i + 1,
        message: `"${memberName}" isimli ekip üyesi bulunamadı.`,
      });
      continue;
    }

    const year = num(r["Yıl"]);
    const month = num(r["Ay"]);
    if (year < 2000 || year > 2100 || month < 1 || month > 12) {
      result.errors.push({ row: i + 1, message: `Geçersiz yıl/ay: ${year}/${month}` });
      continue;
    }

    const plannedDays = num(r["Planlanan Gün"]);
    const actualDays = num(r["Gerçekleşen Gün"]);
    const resourcesStr = str(r["Kaynaklar"]);

    try {
      await prisma.assignment.upsert({
        where: { projectId_memberId_year_month: { projectId, memberId, year, month } },
        create: { projectId, memberId, year, month, plannedDays, actualDays, resources: resourcesStr || null },
        update: { plannedDays, actualDays, resources: resourcesStr || null },
      });
      result.inserted++;
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  revalidatePath("/resources");
  return result;
}

// ── Bütçe Kalemleri ─────────────────────────────────────

export async function bulkImportBudgetItems(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result: BulkResult = { ok: true, inserted: 0, skipped: 0, errors: [] };

  // Proje isim → ID haritası
  const projects = await prisma.project.findMany();
  const projectMap = new Map(projects.map((p) => [p.name, p.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const projectName = str(r["Proje"]);
    const projectId = projectMap.get(projectName);
    if (!projectId) {
      result.errors.push({
        row: i + 1,
        message: `"${projectName}" isimli proje bulunamadı. Önce projeleri yükleyin.`,
      });
      continue;
    }

    const category = str(r["Kategori"]);
    const description = str(r["Açıklama"]);
    if (!category || !description) {
      result.errors.push({ row: i + 1, message: "Kategori ve Açıklama boş bırakılamaz." });
      continue;
    }

    const quantity = num(r["Miktar"]) || 1;
    const unitPrice = num(r["Birim Fiyat"]);
    const currency = (str(r["Para Birimi"]).toUpperCase() || "TRY") as Currency;

    if (!VALID_CURRENCIES.includes(currency)) {
      result.errors.push({ row: i + 1, message: `Geçersiz para birimi: "${currency}". Geçerli: ${VALID_CURRENCIES.join(", ")}` });
      continue;
    }

    try {
      await prisma.budgetItem.create({
        data: {
          projectId,
          category,
          description,
          quantity,
          unitPrice,
          amount: quantity * unitPrice,
          currency,
        },
      });
      result.inserted++;
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  revalidatePath("/");
  return result;
}

// ── Aylık Finans ────────────────────────────────────────

const INCOME_MARKUP = 1.05;

export async function bulkImportFinancials(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result: BulkResult = { ok: true, inserted: 0, skipped: 0, errors: [] };

  const projects = await prisma.project.findMany();
  const projectCodeMap = new Map(projects.map((p) => [p.projectCode, p.id]));
  const projectNameMap = new Map(projects.map((p) => [p.name, p.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    
    const pCode = str(r["Proje Kodu"]);
    const projectName = str(r["Proje"]);
    const projectId = projectCodeMap.get(pCode) || projectNameMap.get(projectName);
    if (!projectId) {
      result.errors.push({
        row: i + 1,
        message: `Proje bulunamadı (Kod: ${pCode}, İsim: ${projectName}).`,
      });
      continue;
    }

    const year = num(r["Yıl"]);
    const month = num(r["Ay"]);
    if (year < 2000 || year > 2100 || month < 1 || month > 12) {
      result.errors.push({ row: i + 1, message: `Geçersiz yıl/ay: ${year}/${month}` });
      continue;
    }

    const expense = num(r["Gider"]);
    const internalIncome = num(r["İç Kaynak Geliri"]);
    const income = Math.round(expense * INCOME_MARKUP * 100) / 100;
    const currency = (str(r["Para Birimi"]).toUpperCase() || "TRY") as Currency;

    if (!VALID_CURRENCIES.includes(currency)) {
      result.errors.push({ row: i + 1, message: `Geçersiz para birimi: "${currency}"` });
      continue;
    }

    try {
      await prisma.monthlyFinancial.upsert({
        where: { projectId_year_month: { projectId, year, month } },
        create: { projectId, year, month, expense, income, internalIncome, currency },
        update: { expense, income, internalIncome, currency },
      });
      result.inserted++;
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  revalidatePath("/finance");
  revalidatePath("/");
  return result;
}

// ── Lisanslar ───────────────────────────────────────────

const VALID_PERIODS: PaymentPeriod[] = ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"];
const VALID_LICENSE_STATUSES: LicenseStatus[] = ["ACTIVE", "EXPIRING", "EXPIRED", "CANCELLED"];

export async function bulkImportLicenses(rows: RawRow[]): Promise<BulkResult> {
  await requireAdmin();
  const result: BulkResult = { ok: true, inserted: 0, skipped: 0, errors: [] };

  const apps = await prisma.application.findMany();
  const appMap = new Map(apps.map((a) => [a.name, a.id]));

  const factories = await prisma.factory.findMany();
  const factoryMap = new Map(factories.map((f) => [f.name, f.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    const appName = str(r["Uygulama"]);
    const applicationId = appMap.get(appName);
    if (!applicationId) {
      result.errors.push({
        row: i + 1,
        message: `"${appName}" isimli uygulama bulunamadı. Önce uygulamaları yükleyin.`,
      });
      continue;
    }

    const factoryName = str(r["Fabrika"]);
    const factoryId = factoryMap.get(factoryName);
    if (!factoryId) {
      result.errors.push({
        row: i + 1,
        message: `"${factoryName}" isimli fabrika bulunamadı.`,
      });
      continue;
    }

    const licenseKey = str(r["Lisans Key"]);
    if (!licenseKey) {
      result.errors.push({ row: i + 1, message: "Lisans Key boş bırakılamaz." });
      continue;
    }

    const isSubStr = str(r["Abonelik"]).toLowerCase();
    const isSubscription = isSubStr === "evet" || isSubStr === "yes" || isSubStr === "true" || isSubStr === "1";

    const currency = (str(r["Para Birimi"]).toUpperCase() || "TRY") as Currency;
    if (!VALID_CURRENCIES.includes(currency)) {
      result.errors.push({ row: i + 1, message: `Geçersiz para birimi: "${currency}"` });
      continue;
    }

    const paymentPeriod = (str(r["Ödeme Periyodu"]).toUpperCase() || "ONE_TIME") as PaymentPeriod;
    if (!VALID_PERIODS.includes(paymentPeriod)) {
      result.errors.push({ row: i + 1, message: `Geçersiz ödeme periyodu: "${paymentPeriod}". Geçerli: ${VALID_PERIODS.join(", ")}` });
      continue;
    }

    const statusStr = (str(r["Durum"]).toUpperCase() || "ACTIVE") as LicenseStatus;
    if (!VALID_LICENSE_STATUSES.includes(statusStr)) {
      result.errors.push({ row: i + 1, message: `Geçersiz durum: "${statusStr}". Geçerli: ${VALID_LICENSE_STATUSES.join(", ")}` });
      continue;
    }

    const renewalDateStr = str(r["Yenileme Tarihi"]);

    try {
      await prisma.license.create({
        data: {
          applicationId,
          factoryId,
          licenseKey,
          description: str(r["Açıklama"]) || null,
          totalInvestment: num(r["Yatırım Bedeli"]),
          isSubscription,
          subscriptionCost: num(r["Abonelik Ücreti"]),
          currency,
          paymentPeriod,
          renewalDate: renewalDateStr ? new Date(renewalDateStr) : null,
          status: statusStr,
        },
      });
      result.inserted++;
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  revalidatePath("/licenses");
  revalidatePath("/admin");
  return result;
}
