# 2026-09-04 — lead detay ciro karti

**Commit:** `9715f0c` · **Şema değişikliği:** yok

## Talep
Lead'lerde Hedef Bütçe kartı yerine Ciro info kartı olsun ve tüm gelirlerin toplamı Ciro
kartında görüntülensin.

## Yapılanlar
- Lead detay sayfasında Hedef Bütçe kartı yerine Ciro (tüm gelirlerin toplamı) kartı gösteriliyor

## Teknik notlar
- Değişiklik `project-detail-client.tsx`'teki tek `StatCard` grid'inde: `project.kind === "PROJECT"` ise "Hedef Bütçe" (`project.targetBudget`), aksi halde (Lead, ve teorik olarak eski bir CR kaydı) "Ciro" (`ciro` = `financeTotals.income + financeTotals.internal`) gösteriliyor.
- `ciro` zaten component'in üstünde Karlılık KPI'ı için hesaplanan aynı değişken — "tüm gelirlerin toplamı" burada proje bazında Gelir + İç Kaynak Geliri toplamı anlamına geliyor (Bütçe & Finans sayfasındaki Ciro tanımıyla birebir aynı formül, sadece tek kayıt için).
- Bu kayıt aynı `ProjectForm`/detay bileşenini Proje ile paylaştığı için, kod tarafında "Lead" özel bir model değil — ayrım `kind` alanına göre yapılıyor.

## Etkilenen dosyalar
- `frontend/src/app/projects/[id]/detail-client.tsx`
