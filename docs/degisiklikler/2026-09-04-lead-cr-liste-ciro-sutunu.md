# 2026-09-04 — lead cr liste ciro sutunu

**Commit:** `ff6b82d` · **Şema değişikliği:** yok

## Talep
[[lead-detay-ciro-karti]] revizyonu yalnızca Lead detay sayfasındaki kartı değiştirmişti; kullanıcı
Lead/CR **liste** sayfasındaki "Hedef Bütçe" sütununun da Ciro'ya (tüm gelirlerin toplamı)
dönüştürülmesini istedi.

## Yapılanlar
- Lead/CR listesinde Hedef Bütçe sütunu yerine Ciro (gerçekleşen tüm gelirlerin toplamı) gösteriliyor

## Teknik notlar
- Liste sayfası daha önce sadece `targetBudget`'ı DTO'ya koyuyordu; Ciro için `financials` toplamı gerektiğinden `lead-cr/page.tsx`'teki sorguya `include: { financials: true }` ve `getRates()` eklendi, her proje için `ciro = Σ toTRY(income) + toTRY(internalIncome)` hesaplanıp `ProjectDTO.ciro` (yeni, opsiyonel alan) olarak DTO'ya kondu.
- `ProjectDTO.ciro` **yalnızca Lead/CR listesinde dolduruluyor** — Projeler sayfası (`projects/page.tsx`) bu alanı hiç set etmiyor, `undefined` kalıyor; Lead/CR tablosunda `p.ciro ?? 0` ile güvenli okunuyor.
- Sıralanabilir sütun anahtarı `"budget"` → `"ciro"` olarak yeniden adlandırıldı (`itemValue()` switch'i ve `SortTH col`).
- Proje detay/liste (Projeler) tarafı hiç değişmedi — orada Hedef Bütçe aynen `targetBudget` olarak kalıyor, bu revizyon yalnızca Lead/CR'ı kapsıyor.

## Etkilenen dosyalar
- `frontend/src/app/lead-cr/lead-cr-client.tsx`
- `frontend/src/app/lead-cr/page.tsx`
- `frontend/src/lib/types.ts`
