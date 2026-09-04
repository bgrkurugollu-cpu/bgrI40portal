# 2026-09-04 — otomatik gelir formul duzeltme

**Commit:** `763605c` · **Şema değişikliği:** yok

## Talep
"Otomatik Gelir Ekle" butonundaki formülde hata bulundu: gelir, giderin sadece %5'i olarak
yazılıyordu. Doğrusu gider + giderin %5'i (yani gider × 1,05) olmalı — bu [[otomatik-yuzde5-gelir-faturasi]]
revizyonunun formül hatasının düzeltilmesi.

## Yapılanlar
- Otomatik gelir formülü düzeltildi: gider + giderin %5'i (önceden yalnızca %5 yazılıyordu)

## Teknik notlar
- `finance.ts`'te `AUTO_INCOME_MARKUP` sabiti `0.05` → `1.05` yapıldı; `autoIncomeAmount = amount * AUTO_INCOME_MARKUP` artık doğrudan gider×1,05 = gider+%5'i veriyor (önceden `amount * 0.05` ile sadece %5'lik dilim yazılıyordu).
- Bu sabit PT modülünde kullanılan `INCOME_MARKUP = 1.05` (Proje `MonthlyFinancial`'daki "gelir en az giderin %5 fazlası olmalı" kuralıyla aynı) mantığıyla artık tutarlı.
- Buton metni ve açıklama metni de yeni formülü yansıtacak şekilde güncellendi ("Otomatik %5 Gelir Ekle" → "Otomatik Gelir Ekle (Gider + %5)").

## Etkilenen dosyalar
- `frontend/src/app/actions/finance.ts`
- `frontend/src/app/projects/[id]/detail-client.tsx`
