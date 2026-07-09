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
 *
 * İçe aktarma her zaman idempotenttir: her entity için doğal bir anahtarla
 * (isim, kod, lisans key vb.) mevcut kayıt aranır. Bulunursa üzerine YAZILIR
 * (güncellenir), bulunamazsa yeni kayıt eklenir. Aynı Excel iki kez yüklense
 * bile satırlar çoğalmaz — bu davranış tüm importer'larda tutarlıdır.
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
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

export type RawRow = Record<string, string | number | Date | null>;

function str(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Excel'den gelen tarih değerini Date'e çevirir. Hücre tarih olarak
 * biçimlendirilmişse Excel bunu seri gün sayısı (örn. 45838) olarak verir;
 * bunu doğrudan `new Date("45838")` ile ayrıştırmak yıl 45838 gibi anlamsız
 * bir tarihe yol açar. Bu yüzden sayısal/Date/string tüm biçimleri ele alır.
 */
function parseExcelDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Excel seri tarihi: gün sayısı, 1899-12-30 referans alınır (Unix epoch farkı 25569 gün).
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
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
  return { ok: true, inserted: 0, updated: 0, skipped: 0, errors: [] };
}

// ── Fabrikalar ──────────────────────────────────────────
// Doğal anahtar: Ad (schema'da @unique).

export async function importFactories(prisma: PrismaClient, rows: RawRow[]): Promise<BulkResult> {
  const result = emptyResult();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = str(r["Ad"]);
    if (!name) {
      result.errors.push({ row: i + 1, message: "Ad boş bırakılamaz." });
      continue;
    }
    const location = str(r["Lokasyon"]) || null;

    try {
      const existing = await prisma.factory.findUnique({ where: { name } });
      if (existing) {
        await prisma.factory.update({ where: { id: existing.id }, data: { location } });
        result.updated++;
      } else {
        await prisma.factory.create({ data: { name, location } });
        result.inserted++;
      }
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  return result;
}

// ── Ekip Üyeleri ────────────────────────────────────────
// Doğal anahtar: Ad Soyad (tam eşleşme; schema'da unique constraint yok).

export async function importMembers(prisma: PrismaClient, rows: RawRow[]): Promise<BulkResult> {
  const result = emptyResult();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = str(r["Ad Soyad"]);
    if (!name) {
      result.errors.push({ row: i + 1, message: "Ad Soyad boş bırakılamaz." });
      continue;
    }
    const activeStr = str(r["Aktif"]).toLowerCase();
    const active = activeStr !== "hayır" && activeStr !== "hayir" && activeStr !== "no" && activeStr !== "false" && activeStr !== "0";
    const title = str(r["Ünvan"]) || null;

    try {
      const existing = await prisma.teamMember.findFirst({ where: { name } });
      if (existing) {
        await prisma.teamMember.update({ where: { id: existing.id }, data: { title, active } });
        result.updated++;
      } else {
        await prisma.teamMember.create({ data: { name, title, active } });
        result.inserted++;
      }
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  return result;
}

// ── Uygulamalar ─────────────────────────────────────────
// Doğal anahtar: Uygulama Adı (schema'da @unique).

export async function importApplications(prisma: PrismaClient, rows: RawRow[]): Promise<BulkResult> {
  const result = emptyResult();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = str(r["Uygulama Adı"]);
    if (!name) {
      result.errors.push({ row: i + 1, message: "Uygulama Adı boş bırakılamaz." });
      continue;
    }
    const vendor = str(r["Üretici"]) || null;

    try {
      const existing = await prisma.application.findUnique({ where: { name } });
      if (existing) {
        await prisma.application.update({ where: { id: existing.id }, data: { vendor } });
        result.updated++;
      } else {
        await prisma.application.create({ data: { name, vendor } });
        result.inserted++;
      }
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  return result;
}

// ── Projeler ────────────────────────────────────────────
// Doğal anahtar: Proje Kodu (schema'da @unique).

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

    // Aynı isimde ama FARKLI kodlu başka bir proje varsa bu bir çakışmadır (güncelleme değil).
    const nameConflict = await prisma.project.findFirst({
      where: { name, NOT: { projectCode } },
    });
    if (nameConflict) {
      result.errors.push({
        row: i + 1,
        message: `"${name}" isimli başka bir proje zaten var (kod: ${nameConflict.projectCode}).`,
      });
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

    const startDate = parseExcelDate(r["Başlangıç"]);
    const endDate = parseExcelDate(r["Bitiş"]);

    const data = {
      name,
      factoryId,
      probability: num(r["İhtimal(%)"]) || 50,
      targetBudget: num(r["Hedef Bütçe"]),
      startDate,
      endDate,
      riskLevel: risk || "MEDIUM",
      priority: priority || "MEDIUM",
      status: status || "PLANNED",
      description: str(r["Açıklama"]) || null,
    };

    try {
      const existing = await prisma.project.findUnique({ where: { projectCode } });
      if (existing) {
        await prisma.project.update({ where: { id: existing.id }, data });
        result.updated++;
      } else {
        await prisma.project.create({ data: { projectCode, ...data } });
        result.inserted++;
      }
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  return result;
}

// ── Kaynak Planı (Assignments) ──────────────────────────
// Doğal anahtar: (Proje, Ekip Üyesi, Yıl, Ay) — schema'da composite @@unique.

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
    const resources = str(r["Kaynaklar"]) || null;

    try {
      const key = { projectId_memberId_year_month: { projectId, memberId, year, month } };
      const existing = await prisma.assignment.findUnique({ where: key });
      await prisma.assignment.upsert({
        where: key,
        create: { projectId, memberId, year, month, plannedDays, actualDays, resources },
        update: { plannedDays, actualDays, resources },
      });
      if (existing) result.updated++;
      else result.inserted++;
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  return result;
}

// ── Bütçe Kalemleri ─────────────────────────────────────
// Doğal anahtar: (Proje, Kategori, Açıklama) — kompozit, DB constraint yok.

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

    const data = { quantity, unitPrice, amount: quantity * unitPrice, currency };

    try {
      const existing = await prisma.budgetItem.findFirst({ where: { projectId, category, description } });
      if (existing) {
        await prisma.budgetItem.update({ where: { id: existing.id }, data });
        result.updated++;
      } else {
        await prisma.budgetItem.create({ data: { projectId, category, description, ...data } });
        result.inserted++;
      }
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  return result;
}

// ── Aylık Finans ────────────────────────────────────────
// Doğal anahtar: (Proje, Yıl, Ay) — schema'da composite @@unique.

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
      const key = { projectId_year_month: { projectId, year, month } };
      const existing = await prisma.monthlyFinancial.findUnique({ where: key });
      await prisma.monthlyFinancial.upsert({
        where: key,
        create: { projectId, year, month, expense, income, internalIncome, currency },
        update: { expense, income, internalIncome, currency },
      });
      if (existing) result.updated++;
      else result.inserted++;
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  return result;
}

// ── Lisanslar ───────────────────────────────────────────
// Doğal anahtar: Lisans Key + Fabrika(lar) + Açıklama.
//
// ÖNEMLİ: Lisans Key TEK BAŞINA benzersiz DEĞİLDİR. Aynı ürün kodu (Lisans Key)
// farklı fabrikalarda, farklı tutarlarda, farklı kalemler (Açıklama) olarak
// ayrı satırlar hâlinde bulunur; her satır kendi başına ayrı bir lisans kaydıdır.
// Bu yüzden dedup için "Lisans Key + bağlı fabrika kümesi + Açıklama" birleşimi
// kullanılır. Aynı dosya tekrar yüklendiğinde her satır kendi eşine denk gelip
// güncellenir (çoğalmaz); farklı fabrika/kalem satırları ayrı ayrı korunur.

/** Lisansın doğal anahtarını üretir (fabrika ID'leri sıralanır ki sıra önemsiz olsun). */
function licenseNaturalKey(licenseKey: string, description: string, factoryIds: string[]): string {
  return [licenseKey, description, [...factoryIds].sort().join(",")].join(" ");
}

export async function importLicenses(prisma: PrismaClient, rows: RawRow[]): Promise<BulkResult> {
  const result = emptyResult();

  const apps = await prisma.application.findMany();
  const appMap = new Map(apps.map((a) => [a.name, a.id]));

  const factories = await prisma.factory.findMany();
  const factoryMap = new Map(factories.map((f) => [f.name, f.id]));

  // Mevcut lisansları doğal anahtarla eşleştirmek için bir kez yükle.
  const existingLicenses = await prisma.license.findMany({ include: { factories: true } });
  const existingByKey = new Map<string, string>();
  for (const l of existingLicenses) {
    existingByKey.set(
      licenseNaturalKey(l.licenseKey, l.description ?? "", l.factories.map((f) => f.id)),
      l.id
    );
  }

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

    const factoryNames = str(r["Fabrika"])
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (factoryNames.length === 0) {
      result.errors.push({ row: i + 1, message: "Fabrika boş bırakılamaz." });
      continue;
    }
    const factoryIds: string[] = [];
    let missingFactory: string | null = null;
    for (const fn of factoryNames) {
      const fid = factoryMap.get(fn);
      if (!fid) {
        missingFactory = fn;
        break;
      }
      factoryIds.push(fid);
    }
    if (missingFactory) {
      result.errors.push({
        row: i + 1,
        message: `"${missingFactory}" isimli fabrika bulunamadı.`,
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

    const renewalDate = parseExcelDate(r["Yenileme Tarihi"]);
    const description = str(r["Açıklama"]);

    const fields = {
      applicationId,
      description: description || null,
      totalInvestment: num(r["Yatırım Bedeli"]),
      isSubscription,
      subscriptionCost: num(r["Abonelik Ücreti"]),
      currency,
      paymentPeriod,
      renewalDate,
      status: statusStr,
    };

    const natKey = licenseNaturalKey(licenseKey, description, factoryIds);

    try {
      const existingId = existingByKey.get(natKey);
      if (existingId) {
        // Aynı Lisans Key + fabrika kümesi + Açıklama: mevcut kaydı güncelle (çoğaltma yok).
        // Fabrika kümesi anahtarın parçası olduğundan set no-op'tur; tutarlılık için yine de yazıyoruz.
        await prisma.license.update({
          where: { id: existingId },
          data: { ...fields, factories: { set: factoryIds.map((id) => ({ id })) } },
        });
        result.updated++;
      } else {
        const created = await prisma.license.create({
          data: { ...fields, licenseKey, factories: { connect: factoryIds.map((id) => ({ id })) } },
        });
        // Aynı içe aktarma içinde birebir aynı satır iki kez geçerse ikincisini de yakala.
        existingByKey.set(natKey, created.id);
        result.inserted++;
      }
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  return result;
}

// ── Faturalar ───────────────────────────────────────────
// Doğal anahtar: (Proje, Açıklama, Fatura Tarihi) — kompozit, DB constraint yok.

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

    if (r["Fatura Tarihi"] == null || str(r["Fatura Tarihi"]) === "") {
      result.errors.push({ row: i + 1, message: "Fatura Tarihi boş bırakılamaz." });
      continue;
    }
    const issueDate = parseExcelDate(r["Fatura Tarihi"]);
    if (!issueDate) {
      result.errors.push({ row: i + 1, message: `Geçersiz fatura tarihi: "${str(r["Fatura Tarihi"])}"` });
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

    const fields = {
      amount,
      currency,
      status,
      ebaNumber: str(r["EBA No"]) || null,
      poNumber: str(r["PO No"]) || null,
    };

    try {
      const existing = await prisma.invoice.findFirst({ where: { projectId, description, issueDate } });
      if (existing) {
        await prisma.invoice.update({ where: { id: existing.id }, data: fields });
        result.updated++;
      } else {
        await prisma.invoice.create({ data: { projectId, description, issueDate, ...fields } });
        result.inserted++;
      }
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  return result;
}
