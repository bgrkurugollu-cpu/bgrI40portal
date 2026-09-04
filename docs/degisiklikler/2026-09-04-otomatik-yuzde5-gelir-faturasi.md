# 2026-09-04 — otomatik yuzde5 gelir faturasi

**Commit:** `0f57121` · **Şema değişikliği:** yok

## Talep
Bazı gider faturalarında önden gelir faturası kesilmiyor (al-sat işleri) — bu durumda giderin
%5'i doğrudan gelir olarak yazılıyor. Fatura Ekle formunda, Gider faturası girilirken bunu tek
tuşla otomatikleştiren bir buton istendi: aynı tarih/ay, EBA No'su sabit "1" olan bir gelir
faturası otomatik oluşsun ki manuel girilen gerçek faturalarla karışmasın.

## Yapılanlar
- Fatura Ekle formuna 'Otomatik %5 Gelir Ekle' butonu eklendi (Gider seçiliyken): giderin %5'i tutarında, aynı tarihli, EBA No'su sabit '1' olan bir gelir faturasını otomatik oluşturur

## Teknik notlar
- Yeni server action: `addInvoiceWithAutoIncome` ([finance.ts](../../frontend/src/app/actions/finance.ts)) — gider faturasını oluşturduktan sonra aynı transaction akışında (iki ayrı `create`) eşlik eden `INCOME` tipinde bir fatura daha yazar: `amount = gider.amount * 0.05` (2 ondalığa yuvarlanır), `currency` giderle aynı, `issueDate` giderle birebir aynı, `ebaNumber` her zaman sabit `"1"` (`AUTO_INCOME_EBA_NUMBER`), `status` giderle aynı.
- Buton yalnızca **yeni fatura ekleme** akışında görünür (`!editingInvoice && invoiceType === "EXPENSE"`) — düzenleme sırasında sunulmuyor, çünkü mevcut bir faturaya sonradan eşlik eden gelir eklemek anlam karmaşası yaratır.
- Buton `type="button"`; forma bağlı `formRef.current.reportValidity()` ile önce native validasyon tetiklenir (ör. EBA No boşsa), sonra `FormData` okunup `addInvoiceWithAutoIncome`'a aktarılır — normal "Ekle" submit akışından bağımsız, ayrı bir server action çağrısı.
- Otomatik oluşan gelir faturasının açıklaması `"Otomatik %5 gelir — <gider açıklaması>"` şeklinde önekleniyor, EBA No "1" ile birlikte bu kayıtları Faturalar tablosunda gerçek/manuel faturalardan ayırt etmeyi sağlıyor.
- `MonthlyFinancial` (Aylık Finans) zaten faturalardan türediği için (`recomputeMonthlyFinancialFromInvoices`) ekstra bir hesaplama gerekmedi — iki fatura da aynı ay için tek `recompute` çağrısıyla yansıtılıyor.

## Etkilenen dosyalar
- `frontend/src/app/actions/finance.ts`
- `frontend/src/app/projects/[id]/detail-client.tsx`
