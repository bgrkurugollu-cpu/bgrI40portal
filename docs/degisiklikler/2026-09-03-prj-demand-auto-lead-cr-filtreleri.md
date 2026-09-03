# 2026-09-03 — prj demand auto lead cr filtreleri

**Commit:** `8ca6785` · **Şema değişikliği:** yok

## Talep
Projeler sayfasında PRJ/DEMAND/AUTO kodlarını, Lead/CR sayfasında CR/Lead kayıtlarını hızlıca filtreleyebilecek seçim kutuları istendi — arama kutusunun hemen sağında, tablonun üzerinde.

## Yapılanlar
- Projeler sayfasına PRJ/DEMAND/AUTO kod filtreleri, Lead/CR sayfasına Lead/CR tür filtreleri eklendi (arama kutusunun sağında hızlı seçim kutuları)

## Teknik notlar
- `projectCode` alanı serbest metin (şemada enum yok); PRJ/DEMAND/AUTO ayrımı kodun **önekine** (case-insensitive `startsWith`) bakılarak client tarafında çıkarılıyor — `codePrefixOf()` bkz. `projects-client.tsx`. Önekle eşleşmeyen kodlar hiçbir filtre kutusu işaretliyken gösterilmez.
- Lead/CR tarafında ayrım zaten DB'deki `kind` alanından (`LEAD`/`CR`) geliyor, önek çıkarımı gerekmedi.
- Checkbox filtreleri ile metin arama AND mantığıyla birleşiyor; hiçbiri işaretli değilse kısıt uygulanmıyor.
- Şema/DB değişikliği yok, sadece client-side filtreleme.

## Etkilenen dosyalar
- `frontend/src/app/lead-cr/lead-cr-client.tsx`
- `frontend/src/app/projects/projects-client.tsx`
