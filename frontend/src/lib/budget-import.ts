/**
 * Bütçe Kırılımı için Excel (.xlsx) içe/dışa aktarma yardımcıları.
 *
 * İçe aktarma iki biçimi de anlar:
 *  1) Uygulamanın kendi dışa aktardığı düz format (Kategori sütunu var).
 *  2) Tedarikçi tekliflerinde yaygın "zengin" format: hiyerarşik bölüm
 *     başlıkları (örn. "1  Teslim Tesellüm Projeleri"), Tedarikçi/Not/TF%
 *     sütunları ve hücre biçimine gömülü ₺/€/£ para birimi sembolleri.
 *     Bu formatta Kategori sütunu yoktur; bölüm başlığı satırı (Miktar,
 *     Birim, Tedarikçi hepsi boş ama açıklama dolu) sonraki kalemlerin
 *     kategorisi olarak kullanılır. "Toplam CAPEX ..." gibi özet satırları
 *     ve tamamen boş satırlar atlanır.
 */
import * as XLSX from "xlsx";
import type { BudgetItemDTO } from "./types";
import type { CurrencyCode } from "./utils";

export type BudgetExpenseType = "CAPEX" | "OPEX";

export type ImportedBudgetItem = {
  expenseType: BudgetExpenseType;
  category: string;
  description: string;
  supplier?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  currency: CurrencyCode;
  note?: string;
  transferFeePercent?: number;
  transferPrice?: number;
  year?: number;
};

export type BudgetImportResult = {
  items: ImportedBudgetItem[];
  warnings: string[];
};

const VALID_CURRENCIES: CurrencyCode[] = ["TRY", "USD", "EUR", "GBP"];

type Field =
  | "expenseType"
  | "category"
  | "description"
  | "supplier"
  | "unit"
  | "quantity"
  | "unitPrice"
  | "amount"
  | "currency"
  | "note"
  | "transferFeePercent"
  | "transferPrice"
  | "year";

function normalizeHeader(h: string): string {
  return h
    .replace(/\(.*?\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/i̇/g, "i")
    .replace(/\s+/g, " ");
}

// Sıra önemli: daha spesifik olanlar (örn. "birim maliyet") önce denenmeli,
// aksi halde "birim" alias'ı "birim maliyet"i de yanlışlıkla eşleştirir.
const HEADER_RULES: { field: Field; test: (h: string) => boolean }[] = [
  { field: "expenseType", test: (h) => h === "tip" || h === "capex/opex" || h === "capex / opex" },
  { field: "category", test: (h) => h === "kategori" },
  { field: "supplier", test: (h) => h.includes("tedarikçi") },
  {
    field: "description",
    test: (h) => h.includes("yapılacak iş") || h === "açıklama",
  },
  { field: "quantity", test: (h) => h === "miktar" },
  { field: "unitPrice", test: (h) => h.startsWith("birim maliyet") || h.startsWith("birim fiyat") },
  { field: "unit", test: (h) => h === "birim" },
  { field: "amount", test: (h) => h.startsWith("toplam maliyet") || h === "tutar" },
  { field: "currency", test: (h) => h.includes("para birimi") },
  { field: "note", test: (h) => h === "not" },
  { field: "transferFeePercent", test: (h) => h.startsWith("tf %") || h.startsWith("tf%") },
  { field: "transferPrice", test: (h) => h.includes("transfer fiyat") },
  { field: "year", test: (h) => h === "yıl" },
];

function matchField(header: string): Field | null {
  const norm = normalizeHeader(header);
  for (const rule of HEADER_RULES) {
    if (rule.test(norm)) return rule.field;
  }
  return null;
}

function detectCurrencyFromText(text: string | undefined): CurrencyCode | null {
  if (!text) return null;
  if (text.includes("₺") || /\bTL\b/i.test(text)) return "TRY";
  if (text.includes("€")) return "EUR";
  if (text.includes("£")) return "GBP";
  if (text.includes("$")) return "USD";
  return null;
}

type Cell = { v?: string | number | Date; w?: string };

function cellText(cell: Cell | undefined): string {
  if (!cell) return "";
  if (cell.w != null) return String(cell.w).trim();
  if (cell.v != null) return String(cell.v).trim();
  return "";
}

function cellNumber(cell: Cell | undefined): number {
  if (!cell || cell.v == null) return 0;
  const n = Number(cell.v);
  return Number.isFinite(n) ? n : 0;
}

function cellPercent(cell: Cell | undefined): number | undefined {
  if (!cell) return undefined;
  const text = cell.w ? String(cell.w) : "";
  const m = text.match(/([\d.,]+)\s*%/);
  if (m) return Number(m[1].replace(",", "."));
  if (cell.v != null) {
    const n = Number(cell.v);
    if (!Number.isFinite(n)) return undefined;
    // Excel yüzde biçimi genelde 0-1 arası ondalık olarak saklanır (örn. %5 → 0.05).
    return n <= 1 ? n * 100 : n;
  }
  return undefined;
}

export function parseBudgetWorkbook(wb: XLSX.WorkBook): BudgetImportResult {
  const warnings: string[] = [];
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws["!ref"]) return { items: [], warnings: ["Sayfa boş."] };
  const range = XLSX.utils.decode_range(ws["!ref"]);

  const getCell = (r: number, c: number): Cell | undefined =>
    ws[XLSX.utils.encode_cell({ r, c })] as Cell | undefined;

  // Başlık satırını bul: "miktar" ve ("birim maliyet" veya "birim fiyat")
  // içeren sütunları aynı anda barındıran ilk 10 satır.
  let headerRow = -1;
  let colMap: Record<number, Field> = {};
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 10); r++) {
    const rowMap: Record<number, Field> = {};
    for (let c = range.s.c; c <= range.e.c; c++) {
      const text = cellText(getCell(r, c));
      if (!text) continue;
      const field = matchField(text);
      if (field) rowMap[c] = field;
    }
    const fields = Object.values(rowMap);
    if (fields.includes("quantity") && fields.includes("unitPrice")) {
      headerRow = r;
      colMap = rowMap;
      break;
    }
  }

  if (headerRow === -1) {
    return {
      items: [],
      warnings: [
        "Başlık satırı bulunamadı. Dosyada en az 'Miktar' ve 'Birim Maliyet/Birim Fiyat' sütunları olmalı.",
      ],
    };
  }

  const hasExplicitCategory = Object.values(colMap).includes("category");
  const items: ImportedBudgetItem[] = [];
  let currentCategory = "Genel";
  let skippedEmpty = 0;

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const row: Partial<Record<Field, Cell | undefined>> = {};
    for (const [colStr, field] of Object.entries(colMap)) {
      row[field] = getCell(r, Number(colStr));
    }

    const description = cellText(row.description);
    const supplier = cellText(row.supplier);
    const unit = cellText(row.unit);
    const quantityRaw = cellText(row.quantity);

    if (!description && !supplier && !quantityRaw) continue; // tamamen boş satır

    if (/^toplam capex/i.test(description)) continue; // özet satırı

    const looksLikeSectionHeader =
      !hasExplicitCategory && !supplier && !unit && !quantityRaw && !!description;
    if (looksLikeSectionHeader) {
      currentCategory = description;
      continue;
    }

    if (!description) {
      skippedEmpty++;
      continue;
    }

    const quantity = cellNumber(row.quantity);
    const unitPrice = cellNumber(row.unitPrice);

    let currency: CurrencyCode | null = null;
    const explicitCurrency = cellText(row.currency).toUpperCase();
    if (VALID_CURRENCIES.includes(explicitCurrency as CurrencyCode)) {
      currency = explicitCurrency as CurrencyCode;
    }
    if (!currency) {
      currency =
        detectCurrencyFromText(row.unitPrice?.w) ??
        detectCurrencyFromText(row.amount?.w) ??
        "TRY";
    }

    const yearCell = row.year ? cellNumber(row.year) : 0;
    const expenseTypeText = cellText(row.expenseType).toUpperCase();
    const expenseType: BudgetExpenseType = expenseTypeText === "OPEX" ? "OPEX" : "CAPEX";

    items.push({
      expenseType,
      category: hasExplicitCategory ? cellText(row.category) || "Genel" : currentCategory,
      description,
      supplier: supplier || undefined,
      unit: unit || undefined,
      quantity,
      unitPrice,
      currency,
      note: cellText(row.note) || undefined,
      transferFeePercent: cellPercent(row.transferFeePercent),
      transferPrice: row.transferPrice ? cellNumber(row.transferPrice) || undefined : undefined,
      year: yearCell > 0 ? yearCell : undefined,
    });
  }

  if (skippedEmpty > 0) {
    warnings.push(`${skippedEmpty} satır açıklama bulunamadığı için atlandı.`);
  }
  if (items.length === 0) {
    warnings.push("İçe aktarılacak kalem bulunamadı.");
  }

  return { items, warnings };
}

export function parseBudgetExcelFile(file: File): Promise<BudgetImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        resolve(parseBudgetWorkbook(wb));
      } catch (err) {
        reject(new Error(`Excel dosyası okunamadı: ${(err as Error).message}`));
      }
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsArrayBuffer(file);
  });
}

const TEMPLATE_HEADERS = [
  "Tip",
  "Kategori",
  "Açıklama",
  "Tedarikçi",
  "Birim",
  "Miktar",
  "Birim Fiyat",
  "Tutar",
  "Para Birimi",
  "Not",
  "TF %",
  "TF (Transfer Fiyatı)",
  "Yıl",
];

const TEMPLATE_EXAMPLES: (string | number)[][] = [
  ["CAPEX", "Donanım", "Endüstriyel PC ve sunucular", "Altis", "ad", 6, 85000, 510000, "TRY", "", 5, 535500, 2026],
  ["OPEX", "Yazılım", "MES lisansları (yıllık abonelik)", "ETZEL", "ad", 1, 18000, 18000, "USD", "Yıllık yenileme", 0, 18000, 2026],
];

const TEMPLATE_NOTES =
  "Tip: CAPEX veya OPEX (boş bırakılırsa CAPEX)  |  Yıl: bütçe kaleminin ait olduğu yıl (örn. 2026)  |  Para Birimi: TRY / USD / EUR / GBP  |  " +
  "Tutar = Miktar × Birim Fiyat  |  TF (Transfer Fiyatı) = Tutar × (1 + TF%/100)  |  " +
  "Tedarikçi teklif formatları da (Tedarikçi, Miktar, Birim, Birim Maliyet (KDV Hariç), Not, TF %, TF (Transfer Fiyatı) sütunlu) doğrudan yüklenebilir — Kategori sütunu yoksa bölüm başlığı satırları kategori olarak kullanılır.";

export function downloadBudgetTemplate() {
  const rows: (string | number)[][] = [
    [`⚠️ ${TEMPLATE_NOTES}`],
    TEMPLATE_HEADERS,
    ...TEMPLATE_EXAMPLES,
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = TEMPLATE_HEADERS.map((h, i) => {
    const maxLen = Math.max(h.length, ...TEMPLATE_EXAMPLES.map((r) => String(r[i] ?? "").length));
    return { wch: Math.min(maxLen + 4, 50) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bütçe Kırılımı");
  XLSX.writeFile(wb, "butce_kirilimi_sablonu.xlsx");
}

export function exportBudgetItemsToExcel(
  items: BudgetItemDTO[],
  fileNameHint: string
) {
  const headers = [
    "Tip",
    "Kategori",
    "Açıklama",
    "Tedarikçi",
    "Birim",
    "Miktar",
    "Birim Fiyat",
    "Tutar",
    "Para Birimi",
    "Not",
    "TF %",
    "TF (Transfer Fiyatı)",
    "Yıl",
  ];
  const rows = items.map((b) => [
    b.expenseType,
    b.category,
    b.description,
    b.supplier ?? "",
    b.unit ?? "",
    b.quantity,
    b.unitPrice,
    b.amount,
    b.currency,
    b.note ?? "",
    b.transferFeePercent ?? "",
    b.transferPrice ?? "",
    b.year,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length));
    return { wch: Math.min(maxLen + 4, 50) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bütçe Kırılımı");
  XLSX.writeFile(wb, `${fileNameHint}_butce_kirilimi.xlsx`);
}
