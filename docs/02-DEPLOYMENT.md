# 02 — Deployment, Veritabanı ve Secret Yönetimi

## Zincir

```
local değişiklik
   → git push (main)
   → GitHub: bgrkurugollu-cpu/bgrI40portal
   → Vercel (bgr14/i40-portal) otomatik production build
   → https://i40-portal.vercel.app
```

Vercel projesi GitHub `main` branch'ine bağlı. **Push = deploy.** Ayrı bir
komut, CLI veya onay gerekmez. Custom domain kasıtlı olarak kullanılmıyor.

## Veritabanı

| | |
|---|---|
| Sağlayıcı | Neon Postgres (Vercel Marketplace) |
| Instance | **`I40DB`** — bu projeye özel |
| Şema | `bgrbrain` |
| Bağlantı | `.env.vercel-production` → `DATABASE_URL` (🔒 gitignore'da) |
| Vercel env | `i40-portal` → Settings → Environment Variables → `DATABASE_URL`, `JWT_SECRET` (ikisi de **Secret** tipinde, kaydedildikten sonra okunamaz) |

### Geçmiş (2026-08-30 öncesi)

Proje eskiden `scoringv2` ile **aynı** Neon instance'ını paylaşıyordu (izole
`bgrbrain` şemasında). 2026-08-30'da veri `I40DB`'ye taşındı ve ayrıştırıldı.
Eski instance'taki `bgrbrain` şeması **yedek amaçlı silinmeden bırakıldı** —
kullanıcı talimat verene kadar dokunulmaz.

> `scoringv2`'nin `public` şemasına **hiçbir koşulda** dokunulmaz.

### Şema senkronu

`frontend/prisma/schema.prisma` değiştiğinde production DB de güncellenmelidir:

```bash
cd /Users/bugrakurugollu/Desktop/i40portal/frontend
DATABASE_URL="$(grep DATABASE_URL ../.env.vercel-production | cut -d= -f2-)" \
  npx prisma db push --skip-generate
```

Bu komut **yalnızca şemayı** (tablo/kolon yapısı) senkronlar. Veri satırlarını
taşımaz. Kolon silmeden önce içinde veri olup olmadığı kontrol edilir.

### DB'ye doğrudan sorgu (doğrulama için)

Host'ta `psql` kurulu değil; Docker üzerinden çalıştırılır. Neon **Postgres 18**
kullandığı için imaj sürümü eşleşmeli. Prisma'ya özel `?schema=` parametresi
`psql` tarafından anlaşılmaz, temizlenir:

```bash
TGT="$(grep DATABASE_URL /Users/bugrakurugollu/Desktop/i40portal/.env.vercel-production \
  | cut -d= -f2- | sed 's/?schema=bgrbrain&/?/')"
docker run --rm postgres:18-alpine psql "$TGT" -c '\dt bgrbrain.*'
```

## Secret yönetimi

Repo **public**. Bu yüzden:

- ✅ Secret'lar: `.env` (local), `.env.vercel-production` (prod) — ikisi de `.gitignore`'da
- ❌ Secret'lar **asla**: kod, `CLAUDE.md`, `docs/`, commit mesajı, README

`.env.vercel-production` yalnızca bu makinede (MacBook Pro) ve Mac mini'de var.
Başka bir makinede yoksa: Vercel dashboard'dan yeni değer alınamaz (Secret tipi
geri okunamaz) — Neon konsolundan connection string yeniden alınmalıdır.

## Vercel build'i bozan bilinen tuzaklar (çözüldü, tekrarlanmasın)

| Sorun | Çözüm |
|---|---|
| `package-lock.json` sadece Docker'ın Alpine/arm64 `lightningcss` varyantını içeriyordu → Vercel'in linux-x64 ortamında build patlıyordu | Lockfile tüm platform varyantlarıyla yeniden üretildi (`rm -rf node_modules package-lock.json && npm install`) |
| Vercel'de Prisma Client üretilmiyordu | `package.json`'a `"postinstall": "prisma generate"` eklendi |
| Server Actions `*.vercel.app` origin'ini reddediyordu | `next.config.mjs` → `experimental.serverActions.allowedOrigins`'e eklendi |

## Sağlık kontrolü (giriş yapmadan)

```bash
# Login denemesi 401 dönüyorsa: sunucu ayakta + DB bağlantısı çalışıyor demektir.
# 500 dönerse DB/env sorunu var.
curl -s -o /dev/null -w "%{http_code}" -X POST https://i40-portal.vercel.app/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"wrong"}'
```
