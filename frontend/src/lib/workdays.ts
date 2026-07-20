// 2026 resmi tatilleri ve köprü izin günleri — Yıldız Holding 2026 tatil takvimi.
// Kaynak planlama kapasitesi, her ay için yalnızca çalışma günleri (hafta içi,
// tatil/köprü hariç) baz alınarak hesaplanır.
//
// Bir gün "çalışma günü" sayılır: Pazartesi–Cuma VE aşağıdaki listede değilse.
// Hafta sonları (Ct/Pa) zaten hariçtir.

// Tam gün tatil/izin (YYYY-MM-DD). Resmi tatiller + köprü izinleri birlikte.
export const NON_WORKING_DAYS: Record<number, string[]> = {
  2026: [
    // ── Resmi Tatiller ──
    "2026-01-01", // Yılbaşı (Perşembe)
    "2026-03-19", // Ramazan Bayramı Arifesi (Perşembe)
    "2026-03-20", // Ramazan Bayramı 1. Gün (Cuma)
    "2026-03-21", // Ramazan Bayramı 2. Gün (Cumartesi)
    "2026-03-22", // Ramazan Bayramı 3. Gün (Pazar)
    "2026-04-23", // Ulusal Egemenlik ve Çocuk Bayramı (Perşembe)
    "2026-05-01", // Emek ve Dayanışma Günü (Cuma)
    "2026-05-19", // Atatürk'ü Anma, Gençlik ve Spor Bayramı (Salı)
    "2026-05-26", // Kurban Bayramı Arifesi (Salı)
    "2026-05-27", // Kurban Bayramı 1. Gün (Çarşamba)
    "2026-05-28", // Kurban Bayramı 2. Gün (Perşembe)
    "2026-05-29", // Kurban Bayramı 3. Gün (Cuma)
    "2026-05-30", // Kurban Bayramı 4. Gün (Cumartesi)
    "2026-07-15", // Demokrasi ve Milli Birlik Günü (Çarşamba)
    "2026-08-30", // Zafer Bayramı (Pazar)
    "2026-10-29", // Cumhuriyet Bayramı (Perşembe)

    // ── Köprü İzinler ──
    "2026-01-02", // Köprü İzin (Cuma)
    "2026-03-16", // Ara Tatil / Köprü İzin (Pazartesi)
    "2026-03-17", // Ara Tatil / Köprü İzin (Salı)
    "2026-03-18", // Ara Tatil / Köprü İzin (Çarşamba)
    "2026-04-24", // Köprü İzin (Cuma)
    "2026-05-18", // Köprü İzin (Pazartesi)
    "2026-05-25", // Köprü İzin (Pazartesi)
    "2026-07-13", // Köprü İzin (Pazartesi)
    "2026-07-14", // Köprü İzin (Salı)
    "2026-07-16", // Köprü İzin (Perşembe)
    "2026-07-17", // Köprü İzin (Cuma)
    "2026-10-28", // Yarım Gün Resmi Tatil + Yarım Gün Köprü İzin (Çarşamba)
    "2026-10-30", // Köprü İzin (Cuma)
  ],
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Verilen yıl/ay (ay 0-index) için çalışma günü sayısı: hafta içi − tatil/köprü. */
export function workingDaysInMonth(year: number, monthIndex0: number): number {
  const holidays = new Set(NON_WORKING_DAYS[year] ?? []);
  const daysInMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(Date.UTC(year, monthIndex0, d)).getUTCDay(); // 0=Pa, 6=Ct
    if (dow === 0 || dow === 6) continue; // hafta sonu
    const key = `${year}-${pad(monthIndex0 + 1)}-${pad(d)}`;
    if (holidays.has(key)) continue; // resmi tatil / köprü izin
    count++;
  }
  return count;
}

/** Yılın 12 ayı için çalışma günü dizisi (Ocak→Aralık). */
export function workingDaysByMonth(year: number): number[] {
  return Array.from({ length: 12 }, (_, i) => workingDaysInMonth(year, i));
}
