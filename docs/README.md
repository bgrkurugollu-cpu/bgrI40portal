# i40portal — Proje Dokümantasyonu

Bu klasör, projenin **kalıcı hafızasıdır**. Amacı: yeni bir Claude Code oturumunda
(veya yeni bir ekip üyesi geldiğinde) projeyi, altyapıyı ve çalışma düzenini
sıfırdan keşfetmek için zaman/token harcamamak.

## 🚀 Yeni bir sohbete mi başlıyorsun?

**Önce şunu oku:** [`00-BASLANGIC.md`](00-BASLANGIC.md)

Tek dosya, ~2 dakika. Projeyi, canlı ortamı, veritabanını ve çalışma akışını
anlatır. Kod tabanını keşfetmeye gerek kalmadan iş yapmaya başlayabilirsin.

## 📚 İçindekiler

| Dosya | Ne anlatır |
|---|---|
| [`00-BASLANGIC.md`](00-BASLANGIC.md) | **Buradan başla.** Proje özeti, canlı ortam, altın kural niteliğindeki çalışma akışı |
| [`01-MIMARI.md`](01-MIMARI.md) | Teknoloji yığını, klasör haritası, önemli dosyalar, kod kalıpları (yetki, DTO, server action) |
| [`02-DEPLOYMENT.md`](02-DEPLOYMENT.md) | GitHub → Vercel otomatik deploy, Neon DB, şema senkronu, secret yönetimi |
| [`03-VERI-MODELI.md`](03-VERI-MODELI.md) | Prisma modelleri ve aralarındaki iş kuralları (finans, fatura, ödeme planı mantığı) |
| [`04-CALISMA-AKISI.md`](04-CALISMA-AKISI.md) | Bir revizyonun baştan sona adımları + kayıt tutma kuralı |
| [`05-MODULLER.md`](05-MODULLER.md) | Modül modül işlevsel referans (hangi ekran ne yapar) |
| [`degisiklikler/`](degisiklikler/) | **Değişiklik günlüğü** — her commit/push burada kayıtlı |

## 🔒 Kritik kural

Bu repo **public**'tir. `docs/` içine **hiçbir secret yazılmaz** —
ne `DATABASE_URL`, ne `JWT_SECRET`, ne şifre. Secret'lar yalnızca
`.gitignore`'daki `.env` ve `.env.vercel-production` dosyalarında durur.
