/**
 * Veritabanını, modelin arayıp bulabileceği küçük metin parçalarına ("chunk")
 * çevirir.
 *
 * Parçalar üç türlüdür:
 *  - `schema`  : tablolar ve ilişkiler (her soruda gönderilir)
 *  - `summary` : sayımlar, toplamlar, kırılımlar (her soruda gönderilir)
 *  - `record`  : tek tek kayıtlar (soruyla ilgili olanlar seçilerek gönderilir)
 *
 * Özet parçaları hesaplanmış toplamlar içerdiği için "toplam bütçe ne kadar"
 * gibi sorularda modelin yüzlerce satırı toplaması gerekmez; bu hem doğruluğu
 * hem de hızı belirgin biçimde artırır.
 *
 * Parçaların tamamı Prisma şemasından türetilir — şemaya yeni bir tablo veya
 * alan eklendiğinde burada değişiklik yapmak gerekmez.
 */

import { prisma } from '@/lib/db';
import { getInvoiceDerivedStatus } from '@/lib/utils';
import { enumLabel, describeSchema, getModels, type ModelInfo } from './introspect';

export type ChunkKind = 'schema' | 'summary' | 'record';

export interface Chunk {
  id: string;
  kind: ChunkKind;
  model: string | null;
  title: string;
  text: string;
  /** Her soruda koşulsuz gönderilsin mi? */
  pinned: boolean;
}

// ── Biçimlendirme ───────────────────────────────────────────────

const nf = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function money(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? nf.format(n) : '0,00';
}

function fmtDate(value: unknown): string {
  if (!value) return 'Belirtilmemiş';
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return 'Belirtilmemiş';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const MONTHS = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export function monthName(m: number): string {
  return MONTHS[m] ?? `${m}. Ay`;
}

/** Bir kaydı tek satırda tanıtan etiket (ör. "BGR-001 — Hat 3 OEE"). */
function label(model: ModelInfo, row: any): string {
  if (!row) return 'Bilinmiyor';
  const parts: string[] = [];
  if (row.projectCode) parts.push(row.projectCode);
  if (row.name && row.name !== row.projectCode) parts.push(row.name);
  if (parts.length === 0 && model.displayField) parts.push(String(row[model.displayField] ?? ''));
  if (parts.length === 0) parts.push(String(row.id ?? '?'));
  return parts.filter(Boolean).join(' — ');
}

/** Skaler bir alanı okunabilir metne çevirir. */
function renderScalar(model: ModelInfo, field: ModelInfo['scalars'][number], row: any): string | null {
  const value = row[field.name];
  if (value === null || value === undefined || value === '') return null;

  if (field.isEnum) return enumLabel(model.name, String(value));
  if (field.type === 'Boolean') {
    if (field.name === 'active') return value ? 'Aktif' : 'Pasif';
    return value ? 'Evet' : 'Hayır';
  }
  if (field.type === 'DateTime') return fmtDate(value);
  if (field.type === 'Decimal' || field.type === 'Float') return money(value);
  if (field.name === 'month' && typeof value === 'number') return monthName(value);
  return String(value);
}

// ── İlişki çözümleme ────────────────────────────────────────────

/**
 * Bir çoklu ilişkinin gerçekten çoka-çok olup olmadığını anlar: karşı tarafta
 * da bu tabloya bakan bir liste alanı varsa çoka-çoktur. Sadece bu tür
 * ilişkiler kayıt metnine yazılır (ör. Proje ↔ Fabrika); bire-çok ilişkiler
 * yerine özet parçaları üretilir.
 */
function isManyToMany(model: ModelInfo, relationTarget: string): boolean {
  const target = getModels().find((m) => m.name === relationTarget);
  return !!target?.toMany.some((r) => r.targetModel === model.name);
}

// ── Kayıt parçaları ─────────────────────────────────────────────

interface LoadedModel {
  model: ModelInfo;
  rows: any[];
}

async function loadAll(): Promise<LoadedModel[]> {
  const models = getModels();
  const loaded: LoadedModel[] = [];

  for (const model of models) {
    const delegate = (prisma as any)[model.delegate];
    if (!delegate?.findMany) continue;

    const include: Record<string, boolean> = {};
    for (const rel of model.toOne) include[rel.name] = true;
    for (const rel of model.toMany) {
      if (isManyToMany(model, rel.targetModel)) include[rel.name] = true;
    }

    const rows = await delegate.findMany(
      Object.keys(include).length > 0 ? { include } : undefined
    );
    loaded.push({ model, rows });
  }

  return loaded;
}

function recordChunk(model: ModelInfo, row: any): Chunk {
  const lines: string[] = [];
  const head = `[${model.label.toUpperCase()}] ${label(model, row)}`;

  for (const field of model.scalars) {
    if (field.isRedacted) continue;
    if (field.name === 'id' || field.name.endsWith('Id')) continue;
    if (model.displayField === field.name) continue;

    const rendered = renderScalar(model, field, row);
    if (rendered === null) continue;
    lines.push(`${field.label}: ${rendered}`);
  }

  // Fatura durumu tarihe göre "Gecikti"/"Yaklaşıyor" olarak zenginleşir.
  if (model.name === 'Invoice' && row.issueDate) {
    const derived = getInvoiceDerivedStatus(String(row.status), row.issueDate);
    lines.push(
      `Türetilmiş Durum: ${derived.label}${derived.description ? ` (${derived.description})` : ''}`
    );
  }

  for (const rel of model.toOne) {
    const target = getModels().find((m) => m.name === rel.targetModel);
    if (!target || !row[rel.name]) continue;
    lines.push(`${rel.label}: ${label(target, row[rel.name])}`);
  }

  for (const rel of model.toMany) {
    const list = row[rel.name];
    if (!Array.isArray(list) || list.length === 0) continue;
    const target = getModels().find((m) => m.name === rel.targetModel);
    if (!target) continue;
    lines.push(`${rel.label}: ${list.map((item) => label(target, item)).join(', ')}`);
  }

  return {
    id: `${model.name}:${row.id ?? lines.length}`,
    kind: 'record',
    model: model.name,
    title: head,
    text: `${head}\n${lines.map((l) => `  ${l}`).join('\n')}`,
    pinned: false,
  };
}

// ── Özet parçaları ──────────────────────────────────────────────

/** Bir alan listesinin para birimi kırılımlı toplamlarını üretir. */
function sumByCurrency(rows: any[], field: string, hasCurrency: boolean): string {
  if (!hasCurrency) {
    const total = rows.reduce((s, r) => s + Number(r[field] ?? 0), 0);
    return money(total);
  }
  const byCurrency = new Map<string, number>();
  for (const r of rows) {
    const cur = String(r.currency ?? 'TRY');
    byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + Number(r[field] ?? 0));
  }
  return [...byCurrency.entries()].map(([cur, total]) => `${money(total)} ${cur}`).join(' + ');
}

function numericFieldsOf(model: ModelInfo): ModelInfo['scalars'] {
  return model.scalars.filter(
    (s) =>
      !s.isRedacted &&
      ['Decimal', 'Float', 'BigInt'].includes(s.type) &&
      !['year', 'month', 'probability'].includes(s.name)
  );
}

/**
 * Her bire-çok ilişki için üst kayıt bazında toplamlar üretir
 * (ör. "BGR-001 projesinin fatura özeti"). Tamamen şemadan türetilir.
 */
function rollupChunks(loaded: LoadedModel[]): Chunk[] {
  const chunks: Chunk[] = [];
  const byModel = new Map(loaded.map((l) => [l.model.name, l]));

  for (const { model, rows } of loaded) {
    if (rows.length === 0) continue;
    const numerics = numericFieldsOf(model);
    const hasCurrency = model.scalars.some((s) => s.name === 'currency');

    for (const rel of model.toOne) {
      const parent = byModel.get(rel.targetModel);
      if (!parent) continue;

      const groups = new Map<string, any[]>();
      for (const row of rows) {
        const related = row[rel.name];
        if (!related?.id) continue;
        if (!groups.has(related.id)) groups.set(related.id, []);
        groups.get(related.id)!.push(row);
      }

      for (const [parentId, groupRows] of groups) {
        const parentRow = parent.rows.find((r) => r.id === parentId);
        if (!parentRow) continue;

        const lines = [`Kayıt sayısı: ${groupRows.length}`];
        for (const field of numerics) {
          lines.push(`Toplam ${field.label}: ${sumByCurrency(groupRows, field.name, hasCurrency)}`);
        }

        // Enum alanların dağılımı (ör. faturaların kaçı kesildi)
        for (const field of model.scalars.filter((s) => s.isEnum && s.name !== 'currency')) {
          const dist = new Map<string, number>();
          for (const r of groupRows) {
            const key = enumLabel(model.name, String(r[field.name]));
            dist.set(key, (dist.get(key) ?? 0) + 1);
          }
          lines.push(
            `${field.label} dağılımı: ${[...dist.entries()].map(([k, v]) => `${k}: ${v}`).join(', ')}`
          );
        }

        const head = `[ÖZET] ${label(parent.model, parentRow)} — ${model.label} toplamları`;
        chunks.push({
          id: `rollup:${model.name}:${rel.name}:${parentId}`,
          kind: 'summary',
          model: model.name,
          title: head,
          text: `${head}\n${lines.map((l) => `  ${l}`).join('\n')}`,
          pinned: false,
        });
      }
    }
  }

  return chunks;
}

/** Tüm veritabanının tek sayfalık genel özeti — her soruda gönderilir. */
function globalSummary(loaded: LoadedModel[]): Chunk {
  const lines: string[] = [];
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  lines.push(`Bugünün tarihi: ${today}`);

  for (const { model, rows } of loaded) {
    if (rows.length === 0) {
      lines.push(`${model.label}: kayıt yok`);
      continue;
    }

    const parts = [`${rows.length} kayıt`];
    const hasCurrency = model.scalars.some((s) => s.name === 'currency');

    for (const field of numericFieldsOf(model)) {
      parts.push(`toplam ${field.label}: ${sumByCurrency(rows, field.name, hasCurrency)}`);
    }

    for (const field of model.scalars.filter((s) => s.isEnum && s.name !== 'currency')) {
      const dist = new Map<string, number>();
      for (const r of rows) {
        const key = enumLabel(model.name, String(r[field.name]));
        dist.set(key, (dist.get(key) ?? 0) + 1);
      }
      parts.push(`${field.label} → ${[...dist.entries()].map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    }

    lines.push(`${model.label} (${model.name}): ${parts.join(' | ')}`);
  }

  const head = '[GENEL ÖZET] Veritabanı geneli sayım ve toplamlar';
  return {
    id: 'summary:global',
    kind: 'summary',
    model: null,
    title: head,
    text: `${head}\n${lines.map((l) => `  ${l}`).join('\n')}`,
    pinned: true,
  };
}

/** Yıl/ay kırılımı olan tablolar için dönemsel toplamlar. */
function periodChunks(loaded: LoadedModel[]): Chunk[] {
  const chunks: Chunk[] = [];

  for (const { model, rows } of loaded) {
    const hasYear = model.scalars.some((s) => s.name === 'year');
    if (!hasYear || rows.length === 0) continue;

    const numerics = numericFieldsOf(model);
    const hasCurrency = model.scalars.some((s) => s.name === 'currency');
    const byYear = new Map<number, any[]>();
    for (const row of rows) {
      const y = Number(row.year);
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y)!.push(row);
    }

    for (const [year, yearRows] of [...byYear.entries()].sort((a, b) => b[0] - a[0])) {
      const lines = [`Kayıt sayısı: ${yearRows.length}`];
      for (const field of numerics) {
        lines.push(`Toplam ${field.label}: ${sumByCurrency(yearRows, field.name, hasCurrency)}`);
      }

      const hasMonth = model.scalars.some((s) => s.name === 'month');
      if (hasMonth) {
        const byMonth = new Map<number, any[]>();
        for (const row of yearRows) {
          const m = Number(row.month);
          if (!byMonth.has(m)) byMonth.set(m, []);
          byMonth.get(m)!.push(row);
        }
        for (const [m, monthRows] of [...byMonth.entries()].sort((a, b) => a[0] - b[0])) {
          const detail = numerics
            .map((f) => `${f.label} ${sumByCurrency(monthRows, f.name, hasCurrency)}`)
            .join(', ');
          lines.push(`  ${monthName(m)}: ${detail}`);
        }
      }

      const head = `[DÖNEM ÖZETİ] ${year} yılı — ${model.label}`;
      chunks.push({
        id: `period:${model.name}:${year}`,
        kind: 'summary',
        model: model.name,
        title: head,
        text: `${head}\n${lines.map((l) => `  ${l}`).join('\n')}`,
        pinned: false,
      });
    }
  }

  return chunks;
}

// ── Giriş noktası ───────────────────────────────────────────────

export interface Knowledge {
  chunks: Chunk[];
  stats: { records: number; summaries: number; totalChars: number };
}

/** Veritabanının o anki halinden tam bir bilgi tabanı üretir. */
export async function buildKnowledge(): Promise<Knowledge> {
  const loaded = await loadAll();

  const schemaText = describeSchema();
  const chunks: Chunk[] = [
    {
      id: 'schema',
      kind: 'schema',
      model: null,
      title: '[ŞEMA] Veritabanı yapısı',
      text: `[ŞEMA] Veritabanı yapısı\n${schemaText}`,
      pinned: true,
    },
    globalSummary(loaded),
    ...periodChunks(loaded),
    ...rollupChunks(loaded),
  ];

  for (const { model, rows } of loaded) {
    for (const row of rows) chunks.push(recordChunk(model, row));
  }

  return {
    chunks,
    stats: {
      records: chunks.filter((c) => c.kind === 'record').length,
      summaries: chunks.filter((c) => c.kind === 'summary').length,
      totalChars: chunks.reduce((s, c) => s + c.text.length, 0),
    },
  };
}
