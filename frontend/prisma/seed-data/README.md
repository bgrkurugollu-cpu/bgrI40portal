# Seed Verisi (Excel)

`prisma/seed.ts`, bu klasördeki Excel dosyalarını **bağımlılık sırasıyla** okuyup
veritabanına aktarır. Böylece repo başka bir makinede klonlanıp seed çalıştırıldığında
sistem gerçek veriyle ayağa kalkar.

## Dosyalar

Her dosya, admin panelindeki **Toplu Yükleme → "şablon indir"** ile üretilen şablonun
doldurulmuş halidir. Beklenen dosya adları (hepsi opsiyonel; olmayan atlanır):

| Sıra | Dosya | İçerik |
|------|-------|--------|
| 1 | `factories.xlsx` | Fabrikalar |
| 2 | `members.xlsx` | Ekip Üyeleri |
| 3 | `applications.xlsx` | Uygulamalar |
| 4 | `projects.xlsx` | Projeler |
| 5 | `assignments.xlsx` | Kaynak Planı |
| 6 | `budgetItems.xlsx` | Bütçe Kalemleri |
| 7 | `financials.xlsx` | Aylık Finans |
| 8 | `licenses.xlsx` | Lisanslar |
| 9 | `invoices.xlsx` | Faturalar |

Sıralama önemlidir: projeler fabrikalara, atamalar/bütçe/finans/fatura ise projelere
bağlıdır. Doğru şablonu kullandığınızdan ve başlık satırlarını değiştirmediğinizden
emin olun.

## Kullanım

```bash
cd frontend
npx prisma db push --force-reset   # şemayı uygula (DB'yi sıfırlar)
npx tsx prisma/seed.ts             # Excel dosyalarını içeri al
```

Admin kullanıcısı her zaman oluşturulur: `admin@bgr.local` / `admin123`.
Bir dosyada hata olursa seed hata mesajlarını basar ve çıkış kodu 1 ile biter.
