/**
 * Prisma şemasını çalışma anında okur (DMMF).
 *
 * Bilgi tabanı bu introspection üzerinden kurulduğu için şemaya yeni bir tablo
 * ya da alan eklendiğinde asistan kendiliğinden onu da bilir; burada veya
 * bilgi tabanında elle bir liste güncellemek gerekmez. Türkçe etiketler sadece
 * okunabilirlik için; eşleşme bulunamazsa alan adı olduğu gibi kullanılır.
 */

import { Prisma } from '@prisma/client';

/** Asistana asla gönderilmeyecek alanlar (gizli/kişisel veri). */
const REDACTED_FIELD_PATTERN = /passwordhash|password|secret|token|licensekey|apikey|salt/i;

/** Bilgi tabanına hiç alınmayacak tablolar. */
const EXCLUDED_MODELS = new Set<string>([]);

const MODEL_LABELS: Record<string, string> = {
  User: 'Kullanıcı',
  Factory: 'Fabrika',
  TeamMember: 'Takım Üyesi',
  Project: 'Proje',
  ProjectLog: 'Proje Log Kaydı',
  Assignment: 'Efor Ataması',
  BudgetItem: 'Bütçe Kalemi',
  MonthlyFinancial: 'Aylık Finansal Kayıt',
  Invoice: 'Fatura',
  Application: 'Uygulama',
  License: 'Lisans',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Ad',
  email: 'E-posta',
  role: 'Rol',
  location: 'Konum',
  title: 'Unvan',
  active: 'Durum',
  projectCode: 'Proje Kodu',
  probability: 'Gerçekleşme İhtimali (%)',
  targetBudget: 'Hedef Bütçe',
  startDate: 'Başlangıç Tarihi',
  endDate: 'Bitiş Tarihi',
  riskLevel: 'Risk Seviyesi',
  priority: 'Öncelik',
  status: 'Durum',
  description: 'Açıklama',
  createdAt: 'Oluşturma Tarihi',
  updatedAt: 'Son Güncelleme',
  field: 'Değişen Alan',
  oldValue: 'Eski Değer',
  newValue: 'Yeni Değer',
  year: 'Yıl',
  month: 'Ay',
  plannedDays: 'Planlanan Adam-Gün',
  actualDays: 'Gerçekleşen Adam-Gün',
  resources: 'Kaynaklar',
  category: 'Kategori',
  quantity: 'Miktar',
  unitPrice: 'Birim Fiyat',
  amount: 'Tutar',
  currency: 'Para Birimi',
  income: 'Gelir',
  expense: 'Gider',
  internalIncome: 'İç Kaynak Geliri',
  issueDate: 'Fatura Tarihi',
  ebaNumber: 'EBA No',
  poNumber: 'PO No',
  vendor: 'Üretici',
  totalInvestment: 'Toplam Yatırım Bedeli',
  isSubscription: 'Abonelik mi',
  subscriptionCost: 'Abonelik Bedeli',
  paymentPeriod: 'Ödeme Periyodu',
  renewalDate: 'Yenileme Tarihi',
};

/** Enum değerlerinin Türkçe karşılıkları. Eşleşme yoksa ham değer kullanılır. */
const ENUM_LABELS: Record<string, string> = {
  PLANNED: 'Planlandı',
  ACTIVE: 'Aktif',
  ON_HOLD: 'Beklemede',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal Edildi',
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik',
  ISSUED: 'Kesildi',
  EXPIRING: 'Süresi Dolmak Üzere',
  EXPIRED: 'Süresi Doldu',
  MONTHLY: 'Aylık',
  QUARTERLY: '3 Aylık',
  YEARLY: 'Yıllık',
  ONE_TIME: 'Tek Seferlik',
};

/**
 * `Invoice.status` gibi aynı adı taşıyan ama farklı anlamı olan enumlar için
 * tabloya özel geçersiz kılmalar.
 */
const ENUM_LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  Invoice: { PLANNED: 'Kesilecek' },
};

export interface ScalarField {
  name: string;
  label: string;
  type: string;
  isEnum: boolean;
  isRedacted: boolean;
}

export interface RelationField {
  name: string;
  label: string;
  targetModel: string;
  isList: boolean;
}

export interface ModelInfo {
  name: string;
  label: string;
  /** `prisma[delegate]` için camelCase ad. */
  delegate: string;
  scalars: ScalarField[];
  /** Tekil ilişkiler — ilgili kaydın adını göstermek için include edilir. */
  toOne: RelationField[];
  /** Çoklu ilişkiler — kayıt metnine sadece özet olarak yansır. */
  toMany: RelationField[];
  /** Kaydı tanımlayan alan (ör. projectCode, name). */
  displayField: string | null;
  hasCreatedAt: boolean;
  hasUpdatedAt: boolean;
}

function toDelegate(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function humanize(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/** Bir kaydı en iyi tanımlayan alanı seçer. */
function pickDisplayField(scalars: ScalarField[]): string | null {
  const preferred = ['projectCode', 'name', 'description', 'email', 'category', 'field'];
  for (const candidate of preferred) {
    if (scalars.some((s) => s.name === candidate && !s.isRedacted)) return candidate;
  }
  return scalars.find((s) => s.type === 'String' && !s.isRedacted && s.name !== 'id')?.name ?? null;
}

let cached: ModelInfo[] | null = null;

/** Şemadaki tüm tabloları döndürür. Süreç ömrü boyunca bir kez hesaplanır. */
export function getModels(): ModelInfo[] {
  if (cached) return cached;

  const enumNames = new Set(Prisma.dmmf.datamodel.enums.map((e) => e.name));

  cached = Prisma.dmmf.datamodel.models
    .filter((m) => !EXCLUDED_MODELS.has(m.name))
    .map((m) => {
      const scalars: ScalarField[] = [];
      const toOne: RelationField[] = [];
      const toMany: RelationField[] = [];

      for (const f of m.fields) {
        if (f.kind === 'object') {
          const rel: RelationField = {
            name: f.name,
            label: FIELD_LABELS[f.name] ?? MODEL_LABELS[f.type] ?? humanize(f.name),
            targetModel: f.type,
            isList: f.isList,
          };
          (f.isList ? toMany : toOne).push(rel);
          continue;
        }
        if (f.isList) continue; // skaler dizi alanları bu şemada yok
        scalars.push({
          name: f.name,
          label: FIELD_LABELS[f.name] ?? humanize(f.name),
          type: f.type,
          isEnum: enumNames.has(f.type),
          isRedacted: REDACTED_FIELD_PATTERN.test(f.name),
        });
      }

      return {
        name: m.name,
        label: MODEL_LABELS[m.name] ?? m.name,
        delegate: toDelegate(m.name),
        scalars,
        toOne,
        toMany,
        displayField: pickDisplayField(scalars),
        hasCreatedAt: scalars.some((s) => s.name === 'createdAt'),
        hasUpdatedAt: scalars.some((s) => s.name === 'updatedAt'),
      };
    });

  return cached;
}

export function getModel(name: string): ModelInfo | undefined {
  return getModels().find((m) => m.name === name);
}

/** Bir enum değerini Türkçeye çevirir; tabloya özel karşılık varsa onu tercih eder. */
export function enumLabel(modelName: string, value: string): string {
  return ENUM_LABEL_OVERRIDES[modelName]?.[value] ?? ENUM_LABELS[value] ?? value;
}

/**
 * Şemanın modele anlatılacak özeti. DMMF'ten üretildiği için şema
 * değiştiğinde bu metin de kendiliğinden değişir.
 */
export function describeSchema(): string {
  const lines: string[] = ['Sistemdeki tablolar, alanları ve ilişkileri:'];

  for (const m of getModels()) {
    const fields = m.scalars
      .filter((s) => !s.isRedacted && s.name !== 'id' && !s.name.endsWith('Id'))
      .map((s) => `${s.label}`)
      .join(', ');
    const relations = [...m.toOne, ...m.toMany]
      .map((r) => `${r.label}${r.isList ? ' (çoklu)' : ''}`)
      .join(', ');

    lines.push(
      `- ${m.label} (${m.name}): ${fields}` + (relations ? ` | İlişkiler: ${relations}` : '')
    );
  }

  const enums = Prisma.dmmf.datamodel.enums
    .map((e) => `${e.name}: ${e.values.map((v) => `${v.name}=${ENUM_LABELS[v.name] ?? v.name}`).join(', ')}`)
    .join('\n  ');
  if (enums) lines.push(`Sabit değer listeleri:\n  ${enums}`);

  return lines.join('\n');
}

/** Şemanın parmak izi — şema değişince indeks yeniden kurulmalı. */
export function schemaFingerprint(): string {
  return getModels()
    .map((m) => `${m.name}:${m.scalars.map((s) => s.name).join(',')}:${[...m.toOne, ...m.toMany].map((r) => r.name).join(',')}`)
    .join('|');
}
