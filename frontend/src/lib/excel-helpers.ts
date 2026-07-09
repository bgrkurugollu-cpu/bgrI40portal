/**
 * Client-side Excel şablon oluşturma ve parse yardımcıları.
 * SheetJS (xlsx) kütüphanesi kullanılır.
 */
import * as XLSX from "xlsx";

// ── Veri tipleri ────────────────────────────────────────

export type ImportType =
  | "factories"
  | "members"
  | "applications"
  | "projects"
  | "assignments"
  | "budgetItems"
  | "financials"
  | "licenses"
  | "invoices";

export const IMPORT_TYPE_LABELS: Record<ImportType, string> = {
  factories: "Fabrikalar",
  members: "Ekip Üyeleri",
  applications: "Uygulamalar",
  projects: "Projeler",
  assignments: "Kaynak Planı",
  budgetItems: "Bütçe Kalemleri",
  financials: "Aylık Finans",
  licenses: "Lisanslar",
  invoices: "Faturalar",
};

// ── Şablon tanımları ────────────────────────────────────

type TemplateDef = {
  headers: string[];
  examples: (string | number)[][];
  notes?: string; // İlk satır olarak not eklenir (enum açıklamaları vb.)
};

const TEMPLATES: Record<ImportType, TemplateDef> = {
  factories: {
    headers: ["Ad", "Lokasyon"],
    examples: [
      ["Gebze Fabrikası", "Gebze / Kocaeli"],
      ["İzmir Fabrikası", "Aliağa / İzmir"],
    ],
  },
  members: {
    headers: ["Ad Soyad", "Ünvan", "Aktif"],
    examples: [
      ["Ahmet Yılmaz", "Takım Lideri", "Evet"],
      ["Elif Demir", "MES Uzmanı", "Evet"],
    ],
    notes: "Aktif sütunu: Evet veya Hayır",
  },
  applications: {
    headers: ["Uygulama Adı", "Üretici"],
    examples: [
      ["Ignition", "Inductive Automation"],
      ["SQL Server", "Microsoft"],
    ],
  },
  projects: {
    headers: [
      "Proje Kodu",
      "Proje İsmi",
      "Fabrika",
      "İhtimal(%)",
      "Hedef Bütçe",
      "Başlangıç",
      "Bitiş",
      "Risk",
      "Öncelik",
      "Durum",
      "Açıklama",
    ],
    examples: [
      [
        "PRJ-101",
        "MES Entegrasyonu",
        "Gebze Fabrikası",
        90,
        2500000,
        "2026-01-15",
        "2026-11-30",
        "MEDIUM",
        "HIGH",
        "ACTIVE",
        "MES kurulumu ve ERP entegrasyonu",
      ],
      [
        "PRJ-102",
        "Enerji İzleme",
        "İzmir Fabrikası",
        70,
        850000,
        "2026-03-01",
        "2026-09-30",
        "LOW",
        "MEDIUM",
        "ACTIVE",
        "Enerji tüketimi izleme altyapısı",
      ],
    ],
    notes:
      "Risk: LOW / MEDIUM / HIGH / CRITICAL  |  Öncelik: LOW / MEDIUM / HIGH / CRITICAL  |  Durum: PLANNED / ACTIVE / ON_HOLD / COMPLETED / CANCELLED  |  Tarih formatı: YYYY-MM-DD",
  },
  assignments: {
    headers: [
      "Proje Kodu",
      "Proje",
      "Ekip Üyesi",
      "Yıl",
      "Ay",
      "Planlanan Gün",
      "Gerçekleşen Gün",
      "Kaynaklar",
    ],
    examples: [
      ["PRJ-101", "MES Entegrasyonu", "Ahmet Yılmaz", 2026, 1, 15, 12, "Ignition Forum"],
      ["PRJ-102", "Enerji İzleme", "Elif Demir", 2026, 2, 5, 0, "Sensör Dökümantasyonu"],
    ],
    notes: "Ay: 1-12 arası sayı  |  Günler 0-31 arası sayı olmalıdır",
  },
  budgetItems: {
    headers: [
      "Proje Kodu",
      "Proje",
      "Kategori",
      "Açıklama",
      "Miktar",
      "Birim Fiyat",
      "Para Birimi",
    ],
    examples: [
      ["PRJ-101", "MES Entegrasyonu", "Yazılım", "MES lisansları", 1, 18000, "USD"],
      [
        "PRJ-101",
        "MES Entegrasyonu",
        "Donanım",
        "Endüstriyel PC ve sunucular",
        6,
        85000,
        "TRY",
      ],
    ],
    notes: "Para Birimi: TRY / USD / EUR / GBP",
  },
  financials: {
    headers: [
      "Proje Kodu",
      "Proje",
      "Yıl",
      "Ay",
      "Gider",
      "İç Kaynak Geliri",
      "Para Birimi",
    ],
    examples: [
      ["PRJ-101", "MES Entegrasyonu", 2026, 1, 120000, 40000, "TRY"],
      ["PRJ-102", "Enerji İzleme", 2026, 5, 4000, 20000, "USD"],
    ],
    notes:
      "Ay: 1-12 arası sayı  |  Para Birimi: TRY / USD / EUR / GBP  |  Gelir otomatik hesaplanır (giderin %5 fazlası)",
  },
  licenses: {
    headers: [
      "Uygulama",
      "Fabrika",
      "Lisans Key",
      "Açıklama",
      "Yatırım Bedeli",
      "Abonelik",
      "Abonelik Ücreti",
      "Para Birimi",
      "Ödeme Periyodu",
      "Yenileme Tarihi",
      "Durum",
    ],
    examples: [
      [
        "Ignition",
        "Gebze Fabrikası, İzmir Fabrikası",
        "IGN-8X2K-9F4M-A1B2",
        "Ignition Platform - Unlimited tags",
        9500,
        "Evet",
        1900,
        "USD",
        "YEARLY",
        "2026-09-01",
        "ACTIVE",
      ],
      [
        "SQL Server",
        "Gebze Fabrikası",
        "MSSQL-STD-2022-4CORE",
        "SQL Server 2022 Standard",
        180000,
        "Evet",
        15000,
        "TRY",
        "MONTHLY",
        "2026-07-25",
        "ACTIVE",
      ],
    ],
    notes:
      "Fabrika: birden fazla fabrika için virgül veya noktalı virgülle ayırın (örn. \"Gebze Fabrikası, İzmir Fabrikası\")  |  Abonelik: Evet / Hayır  |  Para Birimi: TRY / USD / EUR / GBP  |  Ödeme Periyodu: MONTHLY / QUARTERLY / YEARLY / ONE_TIME  |  Durum: ACTIVE / EXPIRING / EXPIRED / CANCELLED  |  Tarih formatı: YYYY-MM-DD",
  },
  invoices: {
    headers: [
      "Proje Kodu",
      "Proje",
      "Açıklama",
      "Tutar",
      "Para Birimi",
      "Fatura Tarihi",
      "Durum",
      "EBA No",
      "PO No",
    ],
    examples: [
      ["PRJ-101", "MES Entegrasyonu", "MES Faz 1 - Avans", 500000, "TRY", "2026-03-15", "PAID", "EBA-2026-001", "PO-1001"],
      ["PRJ-102", "Enerji İzleme", "Enerji izleme - Kurulum", 8000, "USD", "2026-05-20", "ISSUED", "", ""],
    ],
    notes:
      "Para Birimi: TRY / USD / EUR / GBP  |  Durum: PLANNED / ISSUED / PAID / OVERDUE  |  Tarih formatı: YYYY-MM-DD  |  EBA No ve PO No opsiyoneldir",
  },
};

// ── Şablon İndirme ──────────────────────────────────────

export function downloadTemplate(type: ImportType) {
  const def = TEMPLATES[type];
  const label = IMPORT_TYPE_LABELS[type];

  // Veri hazırla
  const rows: (string | number)[][] = [];

  // Not satırı varsa ekle
  if (def.notes) {
    rows.push([`⚠️ ${def.notes}`]);
  }

  // Başlık satırı
  rows.push(def.headers);

  // Örnek satırlar
  rows.push(...def.examples);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Sütun genişliklerini ayarla
  const colWidths = def.headers.map((h, i) => {
    const maxExampleLen = Math.max(
      ...def.examples.map((row) => String(row[i] ?? "").length)
    );
    return { wch: Math.max(h.length, maxExampleLen) + 4 };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, label);
  XLSX.writeFile(wb, `${type}_sablonu.xlsx`);
}

// ── Excel Parse ─────────────────────────────────────────

export type ParsedRow = Record<string, string | number | Date | null>;

/**
 * Ham AoA (array-of-arrays) sayfa verisini başlık + satır nesnelerine çevirir.
 * ⚠️ ile başlayan not satırını, boş satırları atlar. Ortamdan bağımsızdır
 * (tarayıcı `parseExcelFile` ve Node tarafı seed script'i bunu paylaşır).
 */
export function parseSheetRows(
  raw: (string | number | Date | null)[][]
): { headers: string[]; rows: ParsedRow[] } {
  if (raw.length < 2) {
    throw new Error("Dosyada en az başlık satırı ve bir veri satırı olmalıdır.");
  }

  // Not satırını atla (⚠️ ile başlıyorsa)
  let startIdx = 0;
  const firstCell = String(raw[0]?.[0] ?? "");
  if (firstCell.startsWith("⚠️") || firstCell.startsWith("⚠")) {
    startIdx = 1;
  }

  const headers = (raw[startIdx] ?? []).map((h) => String(h ?? "").trim());
  const rows: ParsedRow[] = [];

  for (let i = startIdx + 1; i < raw.length; i++) {
    const rowArr = raw[i];
    if (!rowArr || rowArr.every((c) => c == null || String(c).trim() === ""))
      continue; // boş satırı atla

    const obj: ParsedRow = {};
    for (let j = 0; j < headers.length; j++) {
      const val = rowArr[j];
      obj[headers[j]] = val != null ? val : null;
    }
    rows.push(obj);
  }

  return { headers, rows };
}

export function parseExcelFile(
  file: File
): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const raw: (string | number | Date | null)[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: null,
        });

        resolve(parseSheetRows(raw));
      } catch (err) {
        reject(new Error(`Excel dosyası okunamadı: ${(err as Error).message}`));
      }
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsArrayBuffer(file);
  });
}

// Şablon başlıklarını dışa aç (doğrulama için)
export function getTemplateHeaders(type: ImportType): string[] {
  return TEMPLATES[type].headers;
}
