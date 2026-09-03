# 2026-08-30 — Vercel kurulumu ve veritabanı ayrıştırma

**Commit'ler:** `836f02d`, `c7ca462`, `a4d1f02`, `c348df9`, `9a977cb`
**Şema değişikliği:** yok · **Veri taşıma:** ✅ var (aşağıda)

## Talep
"GitHub ve Vercel tarafında güncellemeler yapacağız" → deploy pipeline'ının
kurulması. Ardından: "scoringv2 ile i40-portal projesinin DB'sini ayıralım.
Yeni DB açtım, mevcut verileri komple buraya taşır mısın?"

## Yapılanlar

### Vercel deploy hazırlığı
Vercel projesi (`bgr14/i40-portal`) zaten `main`'e bağlıydı, ancak build'i
bozan üç sorun tespit edilip giderildi:

1. **Lockfile platform kilidi (kritik):** `package-lock.json` yalnızca Docker'ın
   Alpine/arm64 ortamına ait `lightningcss-linux-arm64-musl` varyantını
   içeriyordu; diğer 10 platform varyantı yoktu. Vercel'in linux-x64 ortamında
   build patlardı. Lockfile sıfırdan yeniden üretildi.
2. **Prisma Client üretilmiyordu:** `package.json`'a
   `"postinstall": "prisma generate"` eklendi.
3. **Server Actions origin reddi:** `next.config.mjs` →
   `experimental.serverActions.allowedOrigins`'e `*.vercel.app` eklendi.

### Güvenlik
Hardcoded local DB şifresi (`bgrsecret`) ve varsayılan admin şifresi
(`admin123`) kaldırıldı; env tabanlı hale getirildi. Seed artık rastgele admin
şifresi üretip terminale bir kez yazdırıyor.

### Veritabanı ayrıştırma
Proje, `scoringv2` ile **aynı** Neon instance'ını paylaşıyordu (izole `bgrbrain`
şemasında). Kullanıcının açtığı yeni `I40DB` instance'ına taşındı:

```bash
# pg_dump/pg_restore sürümü Neon'un Postgres 18'i ile eşleşmeli
docker run --rm -v /tmp/i40dump:/dump postgres:18-alpine \
  pg_dump "$SRC" --schema=bgrbrain --no-owner --no-privileges -Fc -f /dump/bgrbrain.dump
docker run --rm -v /tmp/i40dump:/dump postgres:18-alpine \
  pg_restore --no-owner --no-privileges --clean --if-exists -d "$TGT" /dump/bgrbrain.dump
```

**Doğrulama:** 25 tablo, satır sayıları birebir eşleşti
(User: 7, Project: 47, Assignment: 509, ProjectLog: 59, Invoice: 24).
Dump dosyası işlem sonrası silindi (üretim verisi içeriyordu).

Kullanıcı Vercel'de `DATABASE_URL`'i güncelleyip redeploy etti; canlı
doğrulama yapıldı (`/api/auth/login` → 401, yani DB sorgusu çalışıyor).

## Teknik notlar

- **Neon Postgres 18 kullanıyor.** `pg_dump`/`psql` için `postgres:18-alpine`
  imajı şart, aksi halde "server version mismatch" hatası alınır.
- Vercel'de `DATABASE_URL` **Secret** tipinde; kaydedildikten sonra değeri
  hiç kimse (kullanıcı dahil) geri okuyamaz.
- `psql`, Prisma'ya özel `?schema=` parametresini anlamaz — temizlenmeli.
- Eski instance'taki `bgrbrain` şeması **yedek amaçlı silinmedi**; kullanıcı
  talimat verene kadar duracak.

## Etkilenen dosyalar
- `frontend/package.json` — postinstall
- `frontend/package-lock.json` — tüm platform varyantlarıyla yeniden üretildi
- `frontend/next.config.mjs` — allowedOrigins
- `docker-compose.yml`, `frontend/prisma/seed.ts` — env tabanlı şifreler
- `CLAUDE.md` — §4.2 production deployment + şema senkron kuralı
