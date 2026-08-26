// ISO 8601 hafta numarası yardımcıları — Proje Planı (Gantt) modülü için.
// Tüm hesaplamalar UTC üzerinden yapılır (tarih string'leri "YYYY-MM-DD" formatında, saat dilimi kaymasını önler).

function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function isoWeeksInYear(year: number): number {
  const d = new Date(Date.UTC(year, 0, 1));
  const dow = d.getUTCDay();
  return dow === 4 || (dow === 3 && isLeapYear(year)) ? 53 : 52;
}

// Verilen ISO yıl+hafta'nın Pazartesi gününü döner.
export function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // Pzt=1..Paz=7
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return target;
}

// Verilen tarihin ISO yıl+hafta numarasını döner.
export function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function parseDateUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

// Bir tarihin, verilen takvim yılı içindeki hafta numarasını döner (yıl sınırındaki
// ISO haftalar 1. veya son haftaya sabitlenir — prototip için yeterli hassasiyet).
function weekOfYearClamped(date: Date, year: number): number {
  const iso = getISOWeek(date);
  if (iso.year === year) return iso.week;
  if (iso.year > year) return isoWeeksInYear(year);
  return 1;
}

// Bir görevin başlangıç/bitiş tarihlerinin, verilen yıl içindeki hafta aralığını döner.
// Görev o yılla kesişmiyorsa null döner.
export function weekRangeInYear(
  startDate: string,
  endDate: string,
  year: number
): { startWeek: number; endWeek: number } | null {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const s = parseDateUTC(startDate);
  const e = parseDateUTC(endDate);
  if (e < yearStart || s > yearEnd) return null;
  const clippedStart = s < yearStart ? yearStart : s;
  const clippedEnd = e > yearEnd ? yearEnd : e;
  return {
    startWeek: weekOfYearClamped(clippedStart, year),
    endWeek: weekOfYearClamped(clippedEnd, year),
  };
}

export const MONTH_LABELS_TR = [
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

// Verilen yıl için hafta numaralarını, üstteki ay grubu etiketleriyle birlikte döner.
export function weekColumnsForYear(
  year: number
): { week: number; monthLabel: string | null }[] {
  const total = isoWeeksInYear(year);
  const cols: { week: number; monthLabel: string | null }[] = [];
  let lastMonth = -1;
  for (let w = 1; w <= total; w++) {
    const monday = isoWeekMonday(year, w);
    const month = monday.getUTCMonth();
    cols.push({ week: w, monthLabel: month !== lastMonth ? MONTH_LABELS_TR[month] : null });
    lastMonth = month;
  }
  return cols;
}

// Gün sayısını iş günü mantığı olmadan basitçe hesaplar (start/end dahil).
export function daysBetweenInclusive(startDate: string, endDate: string): number {
  const s = parseDateUTC(startDate);
  const e = parseDateUTC(endDate);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}
