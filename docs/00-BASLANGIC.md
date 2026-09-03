# 00 — Başlangıç (yeni sohbette önce bunu oku)

> Bu dosyanın amacı: yeni bir Claude Code oturumunda projeyi keşfetmek için
> **hiç token harcamamak**. Aşağıdakiler doğrulanmış, güncel bilgilerdir.

## Proje nedir

**i40portal** — DBD (Endüstri 4.0) ekibinin iç yönetim portalı. Proje/Lead-CR
kayıtları, kaynak planlama, bütçe kırılımı, faturalama, aylık finans, CAPEX
bütçesi, lisans takibi ve Gantt bazlı proje planı tek uygulamada toplanır.

Kullanıcı (Buğra Kurugöllü) **ürün sahibi**dir; revizyonları sohbette tarif eder,
uygulama + canlıya alma tarafı bize aittir.

## Nerede ne var

| Ne | Nerede |
|---|---|
| Repo (local) | `/Users/bugrakurugollu/Desktop/i40portal` |
| Uygulama kodu | `frontend/` (Next.js 15 App Router, `src/` düzeni) |
| GitHub | `bgrkurugollu-cpu/bgrI40portal` — branch: `main` (**public repo**) |
| Canlı site | https://i40-portal.vercel.app |
| Vercel projesi | takım `bgr14` → proje `i40-portal` |
| Veritabanı | Neon Postgres — **`I40DB`**, şema: `bgrbrain` |
| Prod DB bağlantısı | `.env.vercel-production` (gitignore'da, sadece bu makinede) |

## Canlıya alma zinciri (ezberlenecek tek şey)

```
kod değişikliği → local build ✅ → (şema değiştiyse) prod DB'ye push
   → git commit → git push → Vercel otomatik deploy → canlı
```

`main`'e her push, Vercel'de **otomatik** production deployment tetikler.
Ekstra bir komut/onay gerekmez.

## Altın kural: bir revizyonun tam adımları

```bash
cd /Users/bugrakurugollu/Desktop/i40portal/frontend

# 1) Şema değiştiyse Prisma client'ı yenile
npx prisma generate

# 2) HER ZAMAN build ile doğrula (tip hataları burada yakalanır)
DATABASE_URL="postgresql://user:pass@localhost:5432/db" JWT_SECRET="test" npm run build

# 3) Şema değiştiyse production DB'yi senkronla
DATABASE_URL="$(grep DATABASE_URL ../.env.vercel-production | cut -d= -f2-)" \
  npx prisma db push --skip-generate

# 4) Commit + push (Türkçe, tek satır, ne yaptığını net anlatan mesaj)
cd .. && git add <dosyalar> && git commit -m "..." && git push

# 5) docs/degisiklikler/ altına kaydı düş  (bkz. 04-CALISMA-AKISI.md)
```

**Not:** 2. adımdaki sahte `DATABASE_URL` kasıtlıdır — tüm sayfalar `dynamic`
olduğu için build sırasında gerçek DB bağlantısı gerekmez.

## Bilinmesi gereken 8 kritik kural

1. **Secret yok.** Repo public. `DATABASE_URL`/`JWT_SECRET` hiçbir commit'lenen
   dosyaya yazılmaz — sadece `.env` ve `.env.vercel-production` (gitignore'da).
2. **Excel/veri dosyaları push edilmez** (`*.xlsx`, `*.sql`, `*.dump`, `/seed/`).
3. **Push öncesi onay sorulmaz.** İş bitince doğrudan commit+push (bkz. CLAUDE.md §4).
4. **Veri (satır) migration'ı otomatik değildir** — sadece şema senkronlanır.
   Gerçek veri taşıma bilinçli, ayrı bir iştir; kullanıcı istemeden yapılmaz.
5. **`scoringv2`'nin DB'sine dokunulmaz.** Artık ayrı instance'tayız ama eski
   paylaşımlı instance'ta yedek amaçlı bir `bgrbrain` şeması duruyor.
6. **İki farklı "admin" kavramı var** — karıştırma:
   - `requirePageEdit("projects")` → sayfa bazlı düzenleme izni (esnek)
   - `requireAdmin()` → **gerçek `role === "ADMIN"`** (katı). Bütçe Kırılımı,
     Aylık Finans manuel düzenleme ve görev JIRA kodu bunu kullanır.
7. **Build her zaman çalıştırılır.** Tip hatalarının %90'ı buradan çıkar.
8. **Her commit `docs/degisiklikler/` altına kaydedilir.**

## Sonraki adım

- Kod kalıpları / klasör haritası → [`01-MIMARI.md`](01-MIMARI.md)
- Deploy & DB detayı → [`02-DEPLOYMENT.md`](02-DEPLOYMENT.md)
- İş kuralları (finans/fatura/karlılık) → [`03-VERI-MODELI.md`](03-VERI-MODELI.md)
- Ne zaman ne yapıldı → [`degisiklikler/README.md`](degisiklikler/README.md)
