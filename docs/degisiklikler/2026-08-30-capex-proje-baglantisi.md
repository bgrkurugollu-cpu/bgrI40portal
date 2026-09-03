# 2026-08-30 — CAPEX alt kalemine proje bağlama + TCMB kur senkronu

**Commit:** `746bbd2` · **Şema değişikliği:** ✅ var

## Talep
"Dijital CAPEX Bütçesi sayfasında alt kalemlerin içerisinde mevcut projeleri
seçebilmeliyim, arama fonksiyonuyla. Bütçesini pound olarak yazdığımda güncel
TCMB kurları üzerinden hesaplayıp projenin hedef bütçesini TL olarak
güncellemelisin."

## Yapılanlar

- **Yeni bileşen:** `components/ui/combobox.tsx` — arama destekli tekli seçim
  (proje adı + proje koduna göre filtreler, temizle butonu var).
- CAPEX alt kalem formuna "Mevcut Proje (opsiyonel)" seçici eklendi.
  Proje seçilince başlık otomatik proje adıyla doluyor.
- Formda canlı önizleme: "kaydedince güncel TCMB kuruyla ₺X olarak projenin
  Hedef Bütçesi'ne yazılacak".
- Kaydedince `syncProjectTargetBudgetFromCapex()` çalışır: tutar CAPEX
  bütçesinin para biriminden TL'ye çevrilip `Project.targetBudget`'a yazılır
  **ve** değişiklik `ProjectLog`'a `targetBudget` alanı olarak düşer.
- CAPEX tablosunda bağlı alt kalemler proje koduyla tıklanabilir link gösterir.
- Sayfaya TCMB kur bandı (`RatesBanner`) eklendi.

## Teknik notlar

```ts
const converted = toTRY(amountInBudgetCurrency, currency, rates);
const newValue = Math.round(converted * 100) / 100;
// Değer değişmediyse log yazılmaz (gürültü önlenir)
```

`RatesBanner`, `app/finance/finance-client.tsx`'ten export edilip yeniden
kullanıldı (o dosya da `"use client"`, güvenli).

## Etkilenen dosyalar
- `frontend/prisma/schema.prisma` — `CapexSubItem.projectId` (opsiyonel, `onDelete: SetNull`) + index
- `frontend/src/components/ui/combobox.tsx` — **yeni**
- `frontend/src/app/actions/capex.ts` — `syncProjectTargetBudgetFromCapex()`
- `frontend/src/app/capex/page.tsx` — proje listesi + kurlar
- `frontend/src/app/capex/capex-client.tsx` — form + tablo
- `frontend/src/lib/types.ts` — `CapexSubItemDTO`
