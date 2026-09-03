# 2026-09-03 — Aylık Finans admin-only düzenleme modu

**Commit:** `9740e48` · **Şema değişikliği:** yok

## Talep
"Aylık finans tablosunda sadece admin manuel değişiklik yapabilir olsun. Sadece
admin girdiğinde bir düzenle butonu çıksın ve tıklandığında tüm aylardaki
tabloyu revize edebilsin."

## Yapılanlar

- Yeni server action: **`upsertMonthlyFinancialManual()`** — `requireAdmin()`
  korumalı. Bir ayın Gider/Gelir/İç Kaynak Geliri değerlerini doğrudan yazar
  (faturadan türetme mantığını atlar).
- Aylık Finans sekmesine **"Düzenle"** butonu eklendi; yalnızca
  `isSuperAdmin` iken görünür.
- Düzenle moduna girince tablonun **tüm 12 ayı × 3 kalemi** inline input'a
  dönüşür. "Kaydet" hepsini birden kaydeder, "Vazgeç" taslağı atar.
- Düzenle modundayken yıl değiştirme butonları devre dışı (taslak kaybolmasın).
- Satır render'ı ortak `MonthlyFinancialRow` bileşenine çıkarıldı
  (salt-okunur / düzenlenebilir aynı bileşen).
- Bilgi metni güncellendi: admin'e "Gerekirse yalnızca admin, 'Düzenle' ile bu
  değerleri elle revize edebilir", diğerlerine "yalnızca admin düzenleyebilir".

## Teknik notlar

- Taslak state'i tek nesnede tutulur:
  `{ expense: number[12], income: number[12], internal: number[12] }`.
  `null` iken düzenleme kapalı demektir.
- Kaydetme 12 ayı paralel yapar (`Promise.all`); her biri kendi `upsert`'ü.
- Düzenleme modundaki toplamlar **taslaktan** hesaplanır, böylece kullanıcı
  değişikliğin etkisini kaydetmeden görür.
- ⚠️ Manuel girilen değerler kalıcı değildir: o proje/ay için bir fatura
  hareketi olursa `recomputeMonthlyFinancialFromInvoices()` üzerine yazar.
  Bu kasıtlıdır — fatura tek doğruluk kaynağıdır, manuel giriş istisnadır.

## Etkilenen dosyalar
- `frontend/src/app/actions/finance.ts` — `upsertMonthlyFinancialManual()`
- `frontend/src/app/projects/[id]/detail-client.tsx` — `MonthlyTab` düzenleme modu, `MonthlyFinancialRow`
