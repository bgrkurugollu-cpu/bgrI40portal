import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MONTHS_TR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export const MONTHS_TR_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

export type CurrencyCode = "TRY" | "USD" | "EUR" | "GBP";

export const CURRENCIES: CurrencyCode[] = ["TRY", "USD", "EUR", "GBP"];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  TRY: "Türk Lirası (₺)",
  USD: "ABD Doları ($)",
  EUR: "Euro (€)",
  GBP: "İngiliz Sterlini (£)",
};

// Gelir en az giderin %5 fazlası olmalıdır (taban değer); üzeri manuel girilebilir.
export const INCOME_MARKUP = 1.05;

export function formatMoney(
  value: number | string | null | undefined,
  currency: CurrencyCode = "TRY"
) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(
    new Date(d)
  );
}

export const RISK_LABELS: Record<string, string> = {
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  CRITICAL: "Kritik",
};

export const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planlandı",
  ACTIVE: "Aktif",
  ON_HOLD: "Beklemede",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Kesilecek",
  ISSUED: "Kesildi",
};

export const INVOICE_APPROACHING_DAYS = 7;

export type InvoiceDerivedStatus = {
  label: string;
  tone: "success" | "warning" | "destructive" | "muted";
  description: string | null;
};

// Fatura statüsü ve planlanan tarihe göre gösterilecek türetilmiş durumu hesaplar.
export function getInvoiceDerivedStatus(
  status: string,
  issueDate: Date | string
): InvoiceDerivedStatus {
  if (status === "ISSUED") {
    return { label: "Kesildi", tone: "success", description: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(issueDate);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return {
      label: "Gecikti",
      tone: "destructive",
      description: `Planlanan tarihten ${Math.abs(diffDays)} gün geçti`,
    };
  }
  if (diffDays <= INVOICE_APPROACHING_DAYS) {
    return {
      label: "Yaklaşıyor",
      tone: "warning",
      description: diffDays === 0 ? "Bugün" : `${diffDays} gün kaldı`,
    };
  }
  return { label: "Kesilecek", tone: "muted", description: null };
}

export const LICENSE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktif",
  EXPIRING: "Yenileme Yaklaşıyor",
  EXPIRED: "Süresi Doldu",
  CANCELLED: "İptal",
};

export const PERIOD_LABELS: Record<string, string> = {
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  YEARLY: "Yıllık",
  ONE_TIME: "Tek Seferlik",
};
