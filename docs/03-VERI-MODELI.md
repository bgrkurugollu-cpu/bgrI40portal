# 03 — Veri Modeli ve İş Kuralları

Kaynak: `frontend/prisma/schema.prisma`. Burada **modellerin arasındaki iş
kuralları** anlatılır — şemanın kendisi tek doğruluk kaynağıdır.

## Model haritası

```
User ──< UserPagePermission           # sayfa bazlı görüntüleme/düzenleme izni
Factory >──< Project                  # çoka-çok
TeamMember ──< Assignment >── Project # kişi × ay efor
TeamMember ──< TaskAssignee >── ProjectTask

Project (kind: PROJECT | LEAD | CR)
 ├─< ProjectLog          # tarihsel değişiklik logu
 ├─< Assignment          # aylık planlanan/gerçekleşen efor
 ├─< BudgetItem          # bütçe kırılımı kalemleri (yıl bazlı)
 ├─< MonthlyFinancial    # ay bazlı gider / gelir / iç kaynak geliri
 ├─< Invoice             # faturalar (type: EXPENSE | INCOME | INTERNAL)
 ├─< PaymentMilestone    # ödeme planı (yüzdelik kalemler)
 ├─< ProjectTask         # Gantt: ana görev (MILESTONE) / alt görev (TASK)
 │    └─< TaskAssignee ──< TaskWeekAllocation   # haftalık gün dağılımı
 └─< CapexSubItem        # CAPEX alt kaleminden bağlantı (opsiyonel)

Pt ──< PtInvoice, PtMonthlyFinancial  # projelerden ayrı, kendi finans takibi
CapexBudget ──< CapexMainItem ──< CapexSubItem
Application ──< License >──< Factory
```

## ⭐ Finans akışı (en kritik kural seti)

### Fatura → Aylık Finans (otomatik, tek yön)

`MonthlyFinancial` **elle girilmez**; `Invoice` kayıtlarından türetilir:

```
Invoice.type = EXPENSE   → MonthlyFinancial.expense
Invoice.type = INCOME    → MonthlyFinancial.income
Invoice.type = INTERNAL  → MonthlyFinancial.internalIncome
```

- Hangi aya yazılacağı `Invoice.issueDate`'ten belirlenir (UTC yıl+ay).
- Tutar, TCMB kuruyla **TL'ye çevrilerek** toplanır.
- Fatura ekle/düzenle/sil → `recomputeMonthlyFinancialFromInvoices()` o ay için
  üç değeri de sıfırdan yeniden hesaplar. Tarih değiştiyse **eski ve yeni ay**
  birlikte yeniden hesaplanır.
- **Tek istisna:** `upsertMonthlyFinancialManual()` — yalnızca gerçek ADMIN,
  Aylık Finans sekmesindeki "Düzenle" moduyla değerleri elle revize edebilir
  (faturaya yansımayan mutabakat farkları için).

### Karlılık

```
Toplam Gelir = income + internalIncome          (iç kaynak geliri, gelirin bir kalemidir)
Karlılık     = (Toplam Gelir − expense) / Toplam Gelir
```

- Proje detayında bilgi kartı olarak gösterilir.
- **%5'in altına düşerse** kart kırmızıya döner ve `animate-pulse` ile yanıp
  sönerek uyarır.
- ⚠️ Eski "gider × %5" formülü **kaldırıldı** (2026-09-03). `INCOME_MARKUP`
  sabiti hâlâ `lib/utils.ts` ve `actions/pt.ts` içinde duruyor ama artık
  yalnızca **PT modülü** için geçerlidir; proje karlılığında kullanılmaz.

### Ödeme Planı (milestone bazlı)

```
Milestone tutarı = Bütçe Kırılımı toplamı (TL) × milestone.percentage / 100
Kesilmesi Gereken Gelir = Bütçe Kırılımı toplamı − kesilmiş (ISSUED) gelir faturaları
```

- "Milestone Ekle" ile istenen sayıda yüzdelik kalem tanımlanır (tipik: 3 kalem).
- Yüzdeler toplamı 100 değilse arayüzde kırmızı uyarı çıkar.
- "Kesilmesi Gereken Gelir" proje detayında bilgi kartıdır.
- `PaymentPlanItem` modeli **eskidir/kullanılmaz** (tarihsel; yerini
  `PaymentMilestone` aldı).

## Proje / Lead / CR

Tek `Project` modeli, `kind` alanıyla ayrılır:

| kind | Menü | Risk/Öncelik |
|---|---|---|
| `PROJECT` | Projeler (`/projects`) | ✅ var |
| `LEAD` | Lead / CR (`/lead-cr`) | ❌ gizli |
| `CR` | Lead / CR (`/lead-cr`) | ❌ gizli |

- Detay sayfası **ortaktır**: `/projects/[id]` — Lead/CR de buraya açılır,
  "geri" linki `kind`'e göre doğru listeye döner.
- İzin anahtarı da `kind`'e göre seçilir: `projects` / `leadcr`.
- Dashboard sayımları yalnızca `kind: PROJECT` içerir.

## Gantt (Proje Planı)

| Şemadaki ad | Arayüzdeki ad |
|---|---|
| `TaskType.MILESTONE` | **Ana Görev** |
| `TaskType.TASK` | **Alt Görev** |

- Hiyerarşi yeni kayıtlarda zorunlu: üst düzey = Ana Görev, bir ana görevin
  altına eklenen = Alt Görev (2 seviye). "+" ikonu yalnızca ana görev
  satırlarında görünür.
- Ana görev çubuğu da başlangıç–bitiş aralığı boyunca uzar (kesikli kenarlık +
  yarı saydam dolgu ile alt görevden ayrılır).
- Haftalık gün girişleri (`TaskWeekAllocation`) otomatik olarak aya toplanıp
  `Assignment.plannedDays`'e yansır → Kaynak Planı güncellenir.
- `jiraCode` + `jiraLink`: yalnızca gerçek ADMIN düzenleyebilir.

## Kaynak Planı

- Kişi × ay planlanan adam-gün matrisi.
- Kapasite `lib/workdays.ts`'ten gelir (hafta içi − resmi tatil − köprü izni).
- **Doluluk kolonu**: `toplam efor / yıllık çalışma günü`. %80 üzeri sarı,
  %100 üzeri kırmızı; tooltip'te kalan/aşan gün sayısı.

## CAPEX ↔ Proje bağlantısı

`CapexSubItem.projectId` doluysa: alt kalemin bütçesi (CAPEX'in para biriminde,
ör. £) güncel TCMB kuruyla **TL'ye çevrilip** ilgili projenin `targetBudget`
alanına yazılır ve değişiklik `ProjectLog`'a düşer.
