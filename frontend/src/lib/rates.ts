import "server-only";

export type Currency = "TRY" | "USD" | "EUR" | "GBP";

export const CURRENCIES: Currency[] = ["TRY", "USD", "EUR", "GBP"];

// 1 birim yabancı paranın kaç TL olduğu (TRY her zaman 1).
export type Rates = {
  TRY: number;
  USD: number;
  EUR: number;
  GBP: number;
  date: string; // kur tarihi (TCMB yayın tarihi) veya "yedek"
  source: "TCMB" | "fallback";
};

// TCMB erişilemezse uygulamanın çökmemesi için makul yedek kurlar.
const FALLBACK: Rates = {
  TRY: 1,
  USD: 46.85,
  EUR: 50.5,
  GBP: 58.0,
  date: "yedek",
  source: "fallback",
};

const TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";

function parseForexSelling(xml: string, code: string): number | null {
  const block = xml.match(
    new RegExp(`<Currency[^>]*CurrencyCode="${code}"[\\s\\S]*?</Currency>`)
  );
  if (!block) return null;
  const unitMatch = block[0].match(/<Unit>([\d.]+)<\/Unit>/);
  const sellMatch = block[0].match(/<ForexSelling>([\d.]+)<\/ForexSelling>/);
  if (!sellMatch) return null;
  const unit = unitMatch ? Number(unitMatch[1]) : 1;
  const selling = Number(sellMatch[1]);
  if (!Number.isFinite(selling) || !Number.isFinite(unit) || unit === 0)
    return null;
  return selling / unit; // 1 birim başına TL
}

/**
 * Güncel TCMB döviz satış kurlarını getirir. Next.js fetch cache'i ile
 * saatte bir yenilenir; TCMB erişilemezse yedek kurlara düşer.
 */
export async function getRates(): Promise<Rates> {
  try {
    const res = await fetch(TCMB_URL, {
      next: { revalidate: 3600 },
      headers: { "User-Agent": "bgr-brain/1.0" },
    });
    if (!res.ok) return FALLBACK;
    const xml = await res.text();

    const usd = parseForexSelling(xml, "USD");
    const eur = parseForexSelling(xml, "EUR");
    const gbp = parseForexSelling(xml, "GBP");
    if (usd == null || eur == null || gbp == null) return FALLBACK;

    const dateMatch = xml.match(/Tarih="([^"]+)"/);

    return {
      TRY: 1,
      USD: usd,
      EUR: eur,
      GBP: gbp,
      date: dateMatch?.[1] ?? new Date().toLocaleDateString("tr-TR"),
      source: "TCMB",
    };
  } catch {
    return FALLBACK;
  }
}

/** Verilen tutarı, kaynak para biriminden TL'ye çevirir. */
export function toTRY(amount: number, currency: Currency, rates: Rates): number {
  return amount * (rates[currency] ?? 1);
}
