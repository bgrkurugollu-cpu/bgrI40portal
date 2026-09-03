# 2026-09-03 — Finans revizyon paketi (6 madde)

**Commit:** `cdbd9f8` · **Şema değişikliği:** ✅ var
**Veri işlemi:** ✅ geriye dönük yeniden hesaplama (aşağıda)

## Talep
1. Bütçe kırılımlarının editi **sadece admin**de olsun.
2. Faturalara göre aylık gider/gelir tablosu **otomatik** oluşsun. Faturada
   gider/gelir seçim kutusu olsun.
3. Aylık finans tablosu ay ay satır değil — **ayları sütuna böl**, gider/gelir/
   iç kaynak birer satır olsun.
4. Proje Planı'nda milestone/görev → **ana görev / alt görev** kavramı.
5. Ödeme Planı sekmesini kaldır, proje bilgisi olarak tut.
6. Proje **karlılığı** görünsün.

## Yapılanlar

### 1. Bütçe Kırılımı admin-only
`actions/finance.ts` içine yerel `requireAdmin()` eklendi; `addBudgetItem`,
`deleteBudgetItem`, `importBudgetItemsForProject` artık `requirePageEdit`
yerine bunu kullanıyor. Arayüzde de butonlar `isSuperAdmin` ile gizleniyor.

### 2. Fatura tipi + otomatik aylık finans
- `InvoiceType` enum'u (`EXPENSE` | `INCOME`) ve `Invoice.type` alanı.
- Fatura formuna "Tip" seçici, tabloya renkli rozet kolonu.
- `recomputeMonthlyFinancialFromInvoices(projectId, year, month)`: o aya ait
  tüm faturaları tipine göre TL'ye çevirip toplar, `MonthlyFinancial`'a yazar.
- Fatura ekle/sil'de ilgili ay; düzenlemede **eski ve yeni ay** yeniden hesaplanır.
- `upsertMonthlyFinancial` kaldırıldı → yerine `upsertInternalIncome`
  (yalnızca iç kaynak geliri elle giriliyordu; sonraki revizyonda o da kalktı).

### 3. Aylık finans tablosu yeniden yapılandırıldı
Satır = ay yapısından **sütun = ay, satır = Gider/Gelir/İç Kaynak Geliri**
yapısına geçildi (`finance-client.tsx`'teki pivot deseni örnek alındı).
Gider ve Gelir salt-okunur.

### 4. Ana Görev / Alt Görev
`TASK_TYPE_LABELS` → `{ TASK: "Alt Görev", MILESTONE: "Ana Görev" }`.
Tüm arayüz metinleri ve Excel export etiketleri güncellendi.

### 5. Ödeme Planı sekmesi kaldırıldı
`PaymentPlanTab` bileşeni, `PaymentPlanItem` server action'ları ve
`PAYMENT_STATUS_LABELS`/`getPaymentPlanDerivedStatus` yardımcıları silindi.
Yerine `Project.paymentPlanNote` (serbest metin) eklendi.
*(Not: bu yaklaşım aynı gün `01f68e0` ile milestone yapısına, `eb9e5e7` ile de
tamamen kaldırılmaya evrildi.)*

### 6. Karlılık KPI'ı
Proje kartına eklendi. *(İlk formül `(İç Kaynak + Gider×%5) / Gelir` idi;
`336408b` ile düzeltildi.)*

## Geriye dönük veri işlemi

Yeni otomatik hesaplama yalnızca **yeni** fatura hareketlerinde tetiklendiği
için, mevcut **34 fatura** tek seferlik bir script ile yeniden işlendi:
21 proje/ay kovası güncellendi. Script çalıştıktan sonra silindi.

## Teknik notlar

- Ay hesabı **UTC** üzerinden: `issueDate.getUTCFullYear()`, `getUTCMonth()+1`.
- `InvoiceDTO.type` **opsiyonel** (`type?`) tutuldu; PT faturaları bu alanı
  taşımadığı için ortak DTO'yu bozmasın diye.
- Ayrı `Textarea` bileşeni oluşturuldu (`eb9e5e7`'de tekrar silindi).

## Etkilenen dosyalar
- `frontend/prisma/schema.prisma` — `InvoiceType`, `Invoice.type`, `Project.paymentPlanNote`
- `frontend/src/app/actions/finance.ts` — büyük yeniden yapılandırma
- `frontend/src/app/projects/[id]/detail-client.tsx` — MonthlyTab, InvoicesTab, sekmeler
- `frontend/src/app/projects/[id]/plan-tab.tsx`, `frontend/src/lib/gantt-export.ts`
- `frontend/src/lib/types.ts`, `frontend/src/lib/utils.ts`
