# AGENTS.md

Bu proje için agent talimatları **tek bir yerde** tutulur:

## 👉 [`CLAUDE.md`](CLAUDE.md)

Ve projenin kalıcı hafızası:

## 👉 [`docs/00-BASLANGIC.md`](docs/00-BASLANGIC.md)

---

Hızlı özet (detay yukarıdaki dosyalarda):

- **Proje:** i40portal — DBD ekibi iç yönetim portalı (Next.js 15 + Prisma + Neon)
- **Canlı:** https://i40-portal.vercel.app · Vercel `bgr14/i40-portal`
- **Deploy:** `main`'e push = otomatik production deployment
- **DB:** Neon `I40DB`, şema `bgrbrain` · bağlantı `.env.vercel-production` (gitignore'da)
- **Kural:** Repo public — hiçbir secret commit'lenmez
- **Kural:** İş bitince onay beklemeden commit + push, ardından
  `docs/degisiklikler/` altına kayıt düşülür

> Bu dosya kasıtlı olarak incedir; içerik çoğaltılmaz ki bayatlamasın.
