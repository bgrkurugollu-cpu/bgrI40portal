/**
 * Sabit "Veri Çek" klasörü (prisma/seed-data) için BOŞ Excel şablonlarını üretir.
 *
 * Her şablon yalnızca açıklama (⚠️ not) satırı + başlık satırı içerir; ÖRNEK VERİ
 * İÇERMEZ. Böylece kullanıcı şablonu doldurup platformdaki "Veri Çek" butonuna
 * bastığında yalnızca gerçek veriler içeri alınır (örnek satırlar sızmaz).
 *
 * Şablon başlıkları/notları admin panelindeki "Şablon İndir" ile birebir aynıdır
 * (kaynak: src/lib/excel-helpers.ts). Yeniden üretmek için:
 *   docker compose exec app npx tsx prisma/generate-templates.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";
import {
  IMPORT_TYPE_LABELS,
  getTemplateHeaders,
  getTemplateNotes,
  type ImportType,
} from "../src/lib/excel-helpers";

const OUT_DIR = path.join(__dirname, "seed-data");

const TYPES: ImportType[] = [
  "factories",
  "members",
  "applications",
  "projects",
  "assignments",
  "budgetItems",
  "financials",
  "licenses",
  "invoices",
];

function buildBlankTemplate(type: ImportType): XLSX.WorkBook {
  const headers = getTemplateHeaders(type);
  const notes = getTemplateNotes(type);
  const label = IMPORT_TYPE_LABELS[type];

  const rows: (string | number)[][] = [];
  if (notes) rows.push([`⚠️ ${notes}`]);
  rows.push(headers);
  // Örnek satır eklenmez — şablon boştur.

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, label);
  return wb;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const type of TYPES) {
    const wb = buildBlankTemplate(type);
    const filePath = path.join(OUT_DIR, `${type}.xlsx`);
    XLSX.writeFile(wb, filePath);
    console.log(`• ${type}.xlsx oluşturuldu`);
  }
  console.log(`\n${TYPES.length} boş şablon üretildi: ${OUT_DIR}`);
}

main();
