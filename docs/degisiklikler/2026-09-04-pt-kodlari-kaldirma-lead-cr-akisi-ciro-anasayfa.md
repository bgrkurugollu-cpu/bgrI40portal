# 2026-09-04 — pt kodlari kaldirma lead cr akisi ciro anasayfa

**Commit:** `11551e7` · **Şema değişikliği:** ✅ var (kodda yapıldı, prod DB'ye push HENÜZ UYGULANMADI — bkz. Teknik notlar)

## Talep
PT Kodları modülü, Lead/CR ile kavramsal olarak çelişiyor — kaldırılması istendi. Bütçe & Finans
sayfasındaki Ciro Dağılımı pasta grafiğinin dış halkasındaki "PT Kırılımı" yerine Lead/CR
kırılımı gösterilmeli; PT'nin kapsadığı finansal akış tamamen Lead/CR'a devrolmalı. Ayrıca Ana
Sayfa'daki Toplam Hedef Bütçe KPI'ı korunmalı, yanına Bütçe & Finans'taki Ciro'nun birebir aynısı
bir "Ciro" info kartı eklenmeli.

## Yapılanlar
- PT Kodları modülü tamamen kaldırıldı (üretimde veri yoktu); Bütçe & Finans'taki Ciro Dağılımı'nda PT kırılımı yerine Proje/Lead-CR kırılımı gösteriliyor; Ana Sayfa'ya Toplam Hedef Bütçe'nin yanına Ciro info kartı eklendi (Bütçe & Finans'takiyle aynı hesap)

## Teknik notlar
- **Kaldırmadan önce prod veri kontrolü yapıldı** (`npx prisma db execute` ile bir `DO $$ ... RAISE EXCEPTION` bloğu, çünkü `db execute` normal `SELECT` çıktısını basmıyor): `Pt=0, PtInvoice=0, PtMonthlyFinancial=0` — tamamen boş, veri kaybı riski yok. Ayrıca `CR` kind'ından da 0 satır çıktı (yalnızca 1 `LEAD` kaydı var); [[lead-cr-cr-kaldirma-proje-kodu-opsiyonel]] revizyonundaki CR retirement kararını da doğruluyor.
- **Şema değişikliği kodda yapıldı (`Pt`/`PtInvoice`/`PtMonthlyFinancial` modelleri `schema.prisma`'dan silindi) ama prod DB'ye `prisma db push` ile HENÜZ UYGULANMADI** — komut Claude Code'un auto-mode sınıflandırıcısı tarafından iki kez engellendi (üretim DB'sine yazan komut olduğu için). Kullanıcıya soruldu, "şimdilik dokunma" cevabı verildi: prod'da bu üç tablo hâlâ (boş halde) duruyor, yeni Prisma Client onları hiç sorgulamadığı için zararsız. İleride birisi bu tabloları temizlemek isterse: `cd frontend && DATABASE_URL="$(grep DATABASE_URL ../.env.vercel-production | cut -d= -f2-)" npx prisma db push --skip-generate` (bu komut kullanıcının kendi terminalinden veya onay isteyerek çalıştırılmalı).
- Dashboard (`page.tsx`) ve Bütçe & Finans (`finance/page.tsx`) sorguları zaten `kind` filtresi kullanmıyordu — `MonthlyFinancial`/`Invoice` PROJECT+LEAD(+CR)'ı otomatik kapsıyordu; asıl değişen PT'nin ayrıca çekilip toplamlara eklenen kısmının tamamen silinmesi oldu.
- `FinancialDTO`'ya `kind?: "PROJECT"|"LEAD"|"CR"` eklendi (`finance/page.tsx`'te `project: { select: { ..., kind: true } }`) — Ciro Dağılımı'nın dış halkası artık `f.source === "PT"` yerine `f.kind === "PROJECT"` ayrımını kullanıyor (`sourceTotals.leadcr`).
- Dashboard'daki yeni "Ciro (TL)" KPI'ı: `page.tsx`'te `monthly` (yılın 12 ayı, `MonthlyFinancial`'dan TL'ye çevrilmiş income+expense+internal) zaten hesaplanıyordu; `totalCiro = monthly.reduce((s,m)=>s+m.income+m.internal,0)` eklendi — Bütçe & Finans'taki `ciro = totals.income + totals.internal` ile aynı formül, sadece kapsamı "seçili yıl" yerine dashboard'un sabit "içinde bulunulan yıl"ı.
- `permissions.ts`'ten `pt` sayfa anahtarı silindi — DB'deki `UserPagePermission` tablosunda `page="pt"` olan eski satırlar (varsa) artık hiçbir kod yolunda okunmuyor, zararsız çöp veri olarak kalıyor (silinmedi).

## Etkilenen dosyalar
- `CLAUDE.md`
- `README.md`
- `docs/01-MIMARI.md`
- `docs/05-MODULLER.md`
- `frontend/prisma/schema.prisma`
- `frontend/src/app/actions/pt.ts`
- `frontend/src/app/dashboard-client.tsx`
- `frontend/src/app/finance/finance-client.tsx`
- `frontend/src/app/finance/page.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/pt/[id]/detail-client.tsx`
- `frontend/src/app/pt/[id]/page.tsx`
- `frontend/src/app/pt/page.tsx`
- `frontend/src/app/pt/pt-client.tsx`
- `frontend/src/app/pt/pt-form.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/lib/permissions.ts`
- `frontend/src/lib/types.ts`
- `memory.md`
