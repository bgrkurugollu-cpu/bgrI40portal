/**
 * Veritabanının "şu anki hali"ni tek bir kısa imzaya indirger.
 *
 * Asistanın bilgi tabanı bu imzaya bağlıdır: imza değiştiği an indeks
 * yeniden kurulur. Böylece uygulamada bir kayıt eklendiğinde, düzenlendiğinde
 * veya silindiğinde bir sonraki soru güncel veriyle yanıtlanır.
 *
 * Birincil sinyal PostgreSQL'in kendi yazma sayaçlarıdır
 * (`pg_stat_user_tables`): her INSERT/UPDATE/DELETE'i sayar, tabloda
 * `updatedAt` sütunu olmasını gerektirmez ve şemaya yeni tablo eklendiğinde
 * onu da kendiliğinden kapsar. Uygulama dışından gelen değişiklikleri
 * (seed, Excel içe aktarma, elle SQL) de yakalar.
 */

import { prisma } from '@/lib/db';
import { getModels, schemaFingerprint } from './introspect';

export interface Fingerprint {
  value: string;
  /** İmzanın hangi yöntemle üretildiği — teşhis için. */
  source: 'pg_stat' | 'aggregate';
  tables: Record<string, number>;
}

/** PostgreSQL yazma sayaçları: en hassas ve en ucuz yöntem. */
async function fromPgStat(): Promise<Fingerprint> {
  const rows = await prisma.$queryRaw<{ relname: string; writes: bigint | number }[]>`
    SELECT relname, (n_tup_ins + n_tup_upd + n_tup_del) AS writes
    FROM pg_stat_user_tables
    ORDER BY relname
  `;

  if (rows.length === 0) throw new Error('pg_stat_user_tables boş döndü');

  const tables: Record<string, number> = {};
  for (const r of rows) tables[r.relname] = Number(r.writes);

  return {
    value: Object.entries(tables).map(([t, w]) => `${t}=${w}`).join(';'),
    source: 'pg_stat',
    tables,
  };
}

/**
 * Yedek yöntem: her tablonun satır sayısı ve sayısal alanlarının toplamı.
 * `pg_stat` okunamadığında (yetki, farklı veritabanı motoru) devreye girer.
 */
async function fromAggregates(): Promise<Fingerprint> {
  const tables: Record<string, number> = {};
  const parts: string[] = [];

  for (const model of getModels()) {
    const delegate = (prisma as any)[model.delegate];
    if (!delegate?.count) continue;

    const count: number = await delegate.count();
    tables[model.name] = count;

    // Sayısal alanların toplamı: mevcut bir kaydın değeri değişince imza da değişir.
    const numericFields = model.scalars
      .filter((s) => !s.isRedacted && ['Int', 'Float', 'Decimal', 'BigInt'].includes(s.type))
      .map((s) => s.name);

    let sums = '';
    if (numericFields.length > 0) {
      const agg = await delegate.aggregate({
        _sum: Object.fromEntries(numericFields.map((f) => [f, true])),
      });
      sums = numericFields.map((f) => `${f}:${Number(agg._sum?.[f] ?? 0)}`).join(',');
    }

    // Zaman damgası olan tablolarda son değişiklik anı da imzaya girer.
    let stamp = '';
    if (model.hasUpdatedAt || model.hasCreatedAt) {
      const field = model.hasUpdatedAt ? 'updatedAt' : 'createdAt';
      const agg = await delegate.aggregate({ _max: { [field]: true } });
      const max = agg._max?.[field];
      stamp = max ? new Date(max).toISOString() : '';
    }

    parts.push(`${model.name}=${count}[${sums}][${stamp}]`);
  }

  return { value: parts.join(';'), source: 'aggregate', tables };
}

/**
 * Veri + şema imzası. Şema imzası da dahildir; böylece Prisma şeması
 * değiştiğinde (yeni tablo/alan) bilgi tabanı yeniden kurulur.
 */
export async function computeFingerprint(): Promise<Fingerprint> {
  let data: Fingerprint;
  try {
    data = await fromPgStat();
  } catch {
    data = await fromAggregates();
  }
  return { ...data, value: `schema(${hash(schemaFingerprint())})|${data.value}` };
}

/** İmzayı loglarda taşınabilir kılmak için kısa, çakışması düşük özet. */
export function hash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return (h1.toString(36) + h2.toString(36)).padStart(12, '0');
}

/**
 * İmzanın raporlanabilir kısa hâli.
 *
 * Ham imza yüzlerce karakter olabilir; baştan kırpmak yanıltıcıdır çünkü
 * yalnızca şema kısmı görünür ve veri değişse bile aynı görünür. Bunun yerine
 * şema ve veri bölümleri ayrı ayrı özetlenir.
 */
export function shortFingerprint(value: string): string {
  const [schemaPart, ...rest] = value.split('|');
  return `${schemaPart}|veri(${hash(rest.join('|'))})`;
}
