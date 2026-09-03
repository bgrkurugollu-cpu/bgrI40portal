# 2026-09-03 — Ödeme Planı milestone yapısı + "Kesilmesi Gereken Gelir"

**Commit:** `01f68e0` · **Şema değişikliği:** ✅ var

## Talep
"Ödeme planında yeni bir fonksiyon geliştireceğiz. 'Milestone ekle' gibi bir şey
yapalım, tıkladıkça milestone sayısı artsın — genelde 3 veya 2 milestone'lu
ödemeler yapıyoruz.

Bütçe kırılımı girildikten sonra en aşağıda toplam, bu milestone sayısındaki
yüzdelere göre bölünsün. Kesilmesi gereken faturalar burada ortaya çıkar.
Bunu projenin bilgi sayfasında karlılık gibi bir info kartta göster."

## Yapılanlar

- **Yeni model:** `PaymentMilestone` (`projectId`, `order`, `label`,
  `percentage`). Eski `PaymentPlanItem` modeli şemada duruyor ama artık
  kullanılmıyor.
- **Yeni sekme:** Ödeme Planı (`Wallet` ikonu). "Milestone Ekle" butonu her
  tıklamada yeni satır ekler (varsayılan "Milestone N", %0).
- Her satırda düzenlenebilir ad + yüzde; **Tutar** kolonu otomatik hesaplanır:

```
Milestone tutarı = Bütçe Kırılımı toplamı (TL) × yüzde / 100
```

- Alt toplamda yüzdeler 100 değilse kırmızı uyarı: "%X (100 olmalı)".
- Kartın altında "Şu ana kadar kesilmiş gelir faturaları" özeti.
- **Yeni bilgi kartı** (proje kartlarında, Karlılık ile aynı formatta):

```
Kesilmesi Gereken Gelir = Bütçe Kırılımı toplamı − kesilmiş (ISSUED) gelir faturaları
```

## Teknik notlar

- Milestone alanları `onBlur`'da kaydediliyor (satır bazlı, ayrı Kaydet butonu yok).
- `percentage` `Decimal(5,2)` — %100.00'e kadar iki ondalık.
- "Kesilmiş gelir" hesabı yalnızca `type === "INCOME" && status === "ISSUED"`
  faturaları sayar; iç kaynak geliri ve gider faturaları dahil değildir.

## Etkilenen dosyalar
- `frontend/prisma/schema.prisma` — `PaymentMilestone` modeli
- `frontend/src/app/actions/finance.ts` — `addPaymentMilestone`, `updatePaymentMilestone`, `deletePaymentMilestone`
- `frontend/src/app/projects/[id]/detail-client.tsx` — `PaymentPlanTab`, `MilestoneRow`, yeni bilgi kartı
- `frontend/src/app/projects/[id]/page.tsx` — milestone sorgusu + DTO
- `frontend/src/lib/types.ts` — `PaymentMilestoneDTO`
