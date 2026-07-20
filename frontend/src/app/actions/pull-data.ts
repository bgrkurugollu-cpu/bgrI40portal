"use server";

import { revalidatePath } from "next/cache";
import type { PrismaClient } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  parseSheetRows,
  IMPORT_TYPE_LABELS,
  type ImportType,
} from "@/lib/excel-helpers";
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

/**
 * "Veri Çek" (sabit klasörden içe aktarma).
 *
 * Toplu Yükleme'nin (elle dosya seçip yükleme) yanında ikinci bir yol: sabit
 * `prisma/seed-data` klasöründeki doldurulmuş şablonları okuyup MEVCUT import
 * çekirdeğiyle (@/lib/bulk-import-core) içeri alır. İçe aktarma mantığı
 * değişmez; burada sadece dosyalar sunucu tarafında okunur.
 *
 * Klasör OneDrive gibi bir bulut sürücüde tutulduğunda, şablonlar online
 * doldurulup senkronize olduğunda bu buton çalıştırılınca güncellemeler
 * platforma yansır. İçe aktarma idempotenttir: tekrar çalıştırmak kayıtları
 * çoğaltmaz, doğal anahtarıyla eşleşenleri günceller.
 */

const SEED_DATA_DIR = path.join(process.cwd(), "prisma", "seed-data");

// Bağımlılık sırası: fabrikalar → projeler → atama/bütçe/finans/fatura, vb.
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

export type PullEntry = {
  type: ImportType;
  label: string;
  found: boolean; // dosya var mı
  result: BulkResult | null; // içe aktarma sonucu (varsa)
  error: string | null; // dosya okuma/işleme hatası (varsa)
};

export type PullSummary = {
  dir: string;
  fileCount: number;
  entries: PullEntry[];
};

/** Bir Excel dosyasını okuyup satır nesnelerine çevirir. Boş şablon → boş dizi. */
function readExcelRows(filePath: string): RawRow[] {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: (string | number | Date | null)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
  });
  // Yalnızca not/başlık satırı olan (veri satırı bulunmayan) boş şablonları atla.
  if (raw.length < 2) return [];
  const { rows } = parseSheetRows(raw);
  return rows as RawRow[];
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Yetkisiz");
  return session;
}

export async function pullSeedData(): Promise<PullSummary> {
  await requireAdmin();

  const entries: PullEntry[] = [];
  let fileCount = 0;

  const dirExists = fs.existsSync(SEED_DATA_DIR);

  for (const { type, run } of IMPORTERS) {
    const label = IMPORT_TYPE_LABELS[type];
    const filePath = dirExists ? path.join(SEED_DATA_DIR, `${type}.xlsx`) : "";

    if (!filePath || !fs.existsSync(filePath)) {
      entries.push({ type, label, found: false, result: null, error: null });
      continue;
    }
    fileCount++;

    try {
      const rows = readExcelRows(filePath);
      const result = await run(prisma, rows);
      entries.push({ type, label, found: true, result, error: null });
    } catch (e) {
      entries.push({
        type,
        label,
        found: true,
        result: null,
        error: (e as Error).message,
      });
    }
  }

  // İçe aktarma tüm modülleri etkileyebileceğinden ilgili sayfaları tazele.
  for (const p of ["/", "/projects", "/resources", "/finance", "/licenses", "/admin"]) {
    revalidatePath(p);
  }

  return { dir: SEED_DATA_DIR, fileCount, entries };
}
