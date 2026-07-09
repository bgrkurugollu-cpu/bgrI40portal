import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";
import { parseSheetRows, type ImportType } from "../src/lib/excel-helpers";
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
} from "../src/lib/bulk-import-core";

const prisma = new PrismaClient();

// seed-data klasöründeki Excel dosyaları bağımlılık sırasıyla içeri alınır.
// Kullanıcı, admin panelindeki "şablon indir" ile ürettiği şablonları
// doldurup bu klasöre {tip}.xlsx olarak koyar (repoya commit edilir).
const SEED_DATA_DIR = path.join(__dirname, "seed-data");

const IMPORTERS: {
  type: ImportType;
  run: (prisma: PrismaClient, rows: RawRow[]) => Promise<BulkResult>;
}[] = [
  { type: "factories", run: importFactories },
  { type: "members", run: importMembers },
  { type: "applications", run: importApplications },
  { type: "projects", run: importProjects },
  { type: "assignments", run: importAssignments },
  { type: "budgetItems", run: importBudgetItems },
  { type: "financials", run: importFinancials },
  { type: "licenses", run: importLicenses },
  { type: "invoices", run: importInvoices },
];

/** Bir Excel dosyasını okuyup satır nesnelerine çevirir (ilk sayfa). */
function readExcelRows(filePath: string): RawRow[] {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: (string | number | Date | null)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
  });
  return parseSheetRows(raw).rows as RawRow[];
}

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("Seed atlandı: veritabanı zaten dolu.");
    return;
  }

  // Admin kullanıcı (Excel şablonu yok; giriş için gerekli).
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      email: "admin@bgr.local",
      name: "Yönetici",
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log("Admin kullanıcı oluşturuldu: admin@bgr.local / admin123");

  if (!fs.existsSync(SEED_DATA_DIR)) {
    console.warn(
      `⚠️  seed-data klasörü bulunamadı (${SEED_DATA_DIR}). Sadece admin kullanıcı oluşturuldu.`
    );
    return;
  }

  let hadErrors = false;

  for (const { type, run } of IMPORTERS) {
    const filePath = path.join(SEED_DATA_DIR, `${type}.xlsx`);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  ${type}.xlsx bulunamadı, atlanıyor.`);
      continue;
    }

    let rows: RawRow[];
    try {
      rows = readExcelRows(filePath);
    } catch (e) {
      console.error(`✗ ${type}.xlsx okunamadı: ${(e as Error).message}`);
      hadErrors = true;
      continue;
    }

    const result = await run(prisma, rows);
    console.log(
      `• ${type}: ${result.inserted} eklendi, ${result.skipped} atlandı, ${result.errors.length} hata`
    );
    for (const err of result.errors) {
      console.error(`    satır ${err.row}: ${err.message}`);
    }
    if (result.errors.length > 0) hadErrors = true;
  }

  if (hadErrors) {
    console.error("\nSeed hatalarla tamamlandı. Lütfen Excel dosyalarını kontrol edin.");
    process.exit(1);
  }

  console.log("\nSeed tamamlandı. Giriş: admin@bgr.local / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
