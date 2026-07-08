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

// Gelir her zaman giderin %5 fazlasıdır.
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
  PLANNED: "Planlandı",
  ISSUED: "Kesildi",
  PAID: "Ödendi",
  OVERDUE: "Gecikmiş",
};

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
