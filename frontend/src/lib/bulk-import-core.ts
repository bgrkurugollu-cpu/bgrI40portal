/**
 * Framework-bağımsız toplu içe aktarma (bulk import) çekirdeği.
 *
 * Bu modül saf iş mantığını içerir: her fonksiyon bir PrismaClient ve satır
 * dizisi alır, DB'ye yazar ve BulkResult döner. Kimlik doğrulama (requireAdmin)
 * veya Next.js'e özgü revalidatePath burada YOKTUR; onlar Server Action
 * sarmalayıcısında ele alınır (src/app/actions/bulk-import.ts).
 *
 * Bu sayede aynı içe aktarma mantığı hem admin panelindeki Server Action'lar
 * hem de prisma/seed.ts tarafından (Node ortamında) yeniden kullanılabilir.
 */
import type {
  Currency,
  InvoiceStatus,
  LicenseStatus,
  PaymentPeriod,
  Priority,
  ProjectStatus,
  RiskLevel,
  PrismaClient,
} from "@prisma/client";

export type BulkResult = {
  ok: boolean;
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

export type RawRow = Record<string, string | number | null>;

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const VALID_RISKS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const VALID_PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const VALID_STATUSES: ProjectStatus[] = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];
const VALID_CURRENCIES: Currency[] = ["TRY", "USD", "EUR", "GBP"];
const VALID_PERIODS: PaymentPeriod[] = ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"];
const VALID_LICENSE_STATUSES: LicenseStatus[] = ["ACTIVE", "EXPIRING", "EXPIRED", "CANCELLED"];
const VALID_INVOICE_STATUSES: InvoiceStatus[] = ["PLANNED", "ISSUED", "PAID", "OVERDUE"];

const INCOME_MARKUP = 1.05;

function emptyResult(): BulkResult {
  return { ok: true, inserted: 0, skipped: 0, errors: [] };
}

// ── Fabrikalar ──────────────────────────────────────────

export async function importFactories(prisma: PrismaClient, rows: RawRow[]): Promise<BulkResult> {
  const result = emptyResult();

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

  return result;
}

// ── Ekip Üyeleri ────────────────────────────────────────

export async function importMembers(prisma: PrismaClient, rows: RawRow[]): Promise<BulkResult> {
  const result = emptyResult();

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

  return result;
}

// ── Uygulamalar ─────────────────────────────────────────

export async function importApplications(prisma: PrismaClient, rows: RawRow[]): Promise<BulkResult> {
  const result = emptyResult();

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

  return result;
}

// ── Projeler ────────────────────────────────────────────

export async function importProjects(prisma: PrismaClient, rows: RawRow[]): Promise<BulkResult> {
  const result = emptyResult();

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

  return result;
}

// ── Kaynak Planı (Assignments) ──────────────────────────

export async function importAssignments(prisma: PrismaClient, rows: RawRow[]): Promise<BulkResult> {
  const result = emptyResult();

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

  return result;
}

// ── Bütçe Kalemleri ─────────────────────────────────────

export async function importBudgetItems(prisma: PrismaClient, rows: RawRow[]): Promise<BulkResult> {
  const result = emptyResult();

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

  return result;
}

// ── Aylık Finans ────────────────────────────────────────

export async function importFinancials(prisma: PrismaClient, rows: RawRow[]): Promise<BulkResult> {
  const result = emptyResult();

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

  return result;
}

// ── Lisanslar ───────────────────────────────────────────

export async function importLicenses(prisma: PrismaClient, rows: RawRow[]): Promise<BulkResult> {
  const result = emptyResult();

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

  return result;
}

// ── Faturalar ───────────────────────────────────────────

export async function importInvoices(prisma: PrismaClient, rows: RawRow[]): Promise<BulkResult> {
  const result = emptyResult();

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

    const description = str(r["Açıklama"]);
    if (!description) {
      result.errors.push({ row: i + 1, message: "Açıklama boş bırakılamaz." });
      continue;
    }

    const issueDateStr = str(r["Fatura Tarihi"]);
    if (!issueDateStr) {
      result.errors.push({ row: i + 1, message: "Fatura Tarihi boş bırakılamaz." });
      continue;
    }
    const issueDate = new Date(issueDateStr);
    if (Number.isNaN(issueDate.getTime())) {
      result.errors.push({ row: i + 1, message: `Geçersiz fatura tarihi: "${issueDateStr}"` });
      continue;
    }

    const amount = num(r["Tutar"]);
    const currency = (str(r["Para Birimi"]).toUpperCase() || "TRY") as Currency;
    if (!VALID_CURRENCIES.includes(currency)) {
      result.errors.push({ row: i + 1, message: `Geçersiz para birimi: "${currency}"` });
      continue;
    }

    const status = (str(r["Durum"]).toUpperCase() || "PLANNED") as InvoiceStatus;
    if (!VALID_INVOICE_STATUSES.includes(status)) {
      result.errors.push({ row: i + 1, message: `Geçersiz durum: "${status}". Geçerli: ${VALID_INVOICE_STATUSES.join(", ")}` });
      continue;
    }

    try {
      await prisma.invoice.create({
        data: {
          projectId,
          description,
          amount,
          currency,
          issueDate,
          status,
          ebaNumber: str(r["EBA No"]) || null,
          poNumber: str(r["PO No"]) || null,
        },
      });
      result.inserted++;
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  return result;
}
