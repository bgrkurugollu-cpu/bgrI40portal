# 2026-09-03 — İç Kaynak Geliri faturası + Karlılık formülü düzeltmesi

**Commit:** `336408b` · **Şema değişikliği:** ✅ var

## Talep
"İç kaynak gelirini de bir fatura olarak eklemeliyim, manuel girmemeliyim.
Fatura tipine iç kaynak gelirini ekler misin?

Yıllık gider / yıllık gelir orası karışmış gibi. Geliri ve gideri ayrı
hesaplamalısın. İç kaynak geliri bir gelir kalemidir. **Gelir + iç kaynak geliri
diye bir hesaplama yoktur.** Giderin yüzde beşi olan formülü bu aylık finans
tablosunda unut."

## Yapılanlar

- `InvoiceType` enum'una **`INTERNAL`** değeri eklendi
  → arayüzde "İç Kaynak Geliri" (mavi rozet).
- `recomputeMonthlyFinancialFromInvoices()` artık **üç** kovayı da faturadan
  hesaplıyor: `INCOME` → income, `INTERNAL` → internalIncome, diğeri → expense.
- Aylık Finans'ta İç Kaynak Geliri satırı **salt-okunur** oldu; elle giriş
  bileşenleri (`InternalIncomeRow` / `InternalIncomeCell`) ve
  `upsertInternalIncome` action'ı kaldırıldı.
- **Karlılık formülü düzeltildi:**

```
Toplam Gelir = Gelir + İç Kaynak Geliri
Karlılık     = (Toplam Gelir − Gider) / Toplam Gelir
```

  Eski `(İç Kaynak + Gider×%5) / Gelir` formülü ve `INCOME_MARKUP` kullanımı
  proje tarafından tamamen kaldırıldı. `ciro` da artık aynı tabanı kullanıyor.

## Teknik notlar

- `INCOME_MARKUP = 1.05` sabiti `lib/utils.ts` ve `actions/pt.ts`'te **duruyor**
  ama artık yalnızca **PT modülü** için geçerli. Proje finansında kullanılmaz.
- Uyarı: Bu değişiklikten önce elle girilmiş `internalIncome` değerleri, ilgili
  proje/ay için herhangi bir fatura hareketi olduğunda sıfırlanır (artık
  faturadan türetiliyor). Kullanıcıya bildirildi.

## Etkilenen dosyalar
- `frontend/prisma/schema.prisma` — `InvoiceType.INTERNAL`
- `frontend/src/app/actions/finance.ts` — üçlü hesaplama, `upsertInternalIncome` silindi
- `frontend/src/app/projects/[id]/detail-client.tsx` — karlılık formülü, salt-okunur satır
- `frontend/src/lib/utils.ts` — `INVOICE_TYPE_LABELS.INTERNAL`
- `frontend/src/lib/types.ts` — `InvoiceDTO.type`
