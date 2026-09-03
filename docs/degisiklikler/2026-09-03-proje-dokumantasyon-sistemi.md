# 2026-09-03 — Kalıcı proje dokümantasyonu ve değişiklik günlüğü

**Commit:** `9bafa01` · **Şema değişikliği:** yok

## Talep
"Mevcut Vercel deployment sistemimle bu chatte konuşarak revizyon yapmamı
sağlayan tüm config'i, yeni Claude Code chatlerimde de kullanmamı sağlayacak bir
dokümantasyon ve klasör yapısı oluştur. Bundan sonra yaptığımız tüm revizyonlar
bu klasörün içerisinde uzun vadeli ayrı .md dosyaları olarak tutulsun. Her bir
commit'i ve push'u kayıt altına almanı istiyorum. Yeni chatlerde projeyi ve
Vercel bağlantılarını anlamak için token harcamayacağın bir düzen oluştur."

## Yapılanlar

`docs/` klasörü projenin **kalıcı hafızası** olarak kuruldu:

| Dosya | İçerik |
|---|---|
| `README.md` | Klasör indeksi / navigasyon |
| `00-BASLANGIC.md` | ⭐ Yeni sohbette önce okunacak: proje özeti, canlı ortam, altın kural akışı, 8 kritik kural |
| `01-MIMARI.md` | Teknoloji yığını, klasör haritası, kod kalıpları (DTO, iki kademeli yetki, dialog form remount) |
| `02-DEPLOYMENT.md` | GitHub→Vercel zinciri, Neon `I40DB`, şema senkronu, secret yönetimi, bilinen build tuzakları |
| `03-VERI-MODELI.md` | Model haritası + iş kuralları (fatura→finans akışı, karlılık, ödeme planı formülleri) |
| `04-CALISMA-AKISI.md` | Bir revizyonun 8 adımı + kayıt tutma kuralı + yapılmayacaklar |
| `05-MODULLER.md` | Modül modül işlevsel referans, yetki notlarıyla |
| `degisiklikler/` | Değişiklik günlüğü: indeks tablosu + commit bazlı detay dosyaları |
| `degisiklikler/yeni-kayit.sh` | Son commit'i otomatik günlüğe işleyen script |

Geriye dönük olarak Vercel dönemindeki **15 commit** ve **3 commit'siz altyapı
işlemi** (DB taşıma, geriye dönük veri düzeltmesi, env dosyası oluşturma) kayıt
altına alındı; Vercel öncesi geçmiş özet tabloya işlendi.

**Bağlantı noktaları:**
- `CLAUDE.md` başına belirgin bir "önce şunu oku" bloğu eklendi (Claude Code bu
  dosyayı her oturumda otomatik yüklüyor → yeni sohbetler docs'u anında bulur).
- `CLAUDE.md`'ye **§4.3 Değişiklik Kaydı** kuralı eklendi (her commit
  günlüğe işlenir).
- `AGENTS.md` bayat bir CLAUDE.md kopyasıydı → ince bir yönlendiriciye çevrildi.

## Teknik notlar

- **Neden repo içinde, ayrı bir Desktop klasöründe değil:** repo zaten
  `~/Desktop/i40portal`'da. Repo içinde olması dokümanı git ile versiyonluyor,
  her klonda getiriyor ve `CLAUDE.md` üzerinden otomatik keşfedilir kılıyor.
  Ayrı bir klasör versiyonsuz kalır ve zamanla koddan sapardı.
- `CLAUDE.md` §4.2'de **iki bayat bilgi** düzeltildi: (1) "host makinede
  node/npx yok, docker exec kullan" — artık host'tan doğrudan çalışıyor;
  (2) "`.env.vercel-production` sadece Mac mini'de" — bu MacBook'ta da var.
- `yeni-kayit.sh` son commit'in hash/tarih/konu/dosya listesini okur, şema
  değişikliği olup olmadığını `prisma/schema.prisma` dokunulmuş mu diye
  anlar, README tablosuna satırı `awk` ile en üste ekler ve şablon dosyayı
  üretir. Sadece 5 kolonlu Vercel-dönemi tablosunu hedefler (Vercel öncesi
  tablo 3 kolonlu olduğu için yanlışlıkla eşleşmez).
- **Secret taraması yapıldı:** `docs/` içinde connection string/şifre yok.
  Repo public olduğu için bu her kayıt sonrası tekrarlanmalı.

## Etkilenen dosyalar
- `docs/**` — **yeni** (18 dosya)
- `CLAUDE.md` — docs yönlendirmesi, §4.3 kaydı, §4.2 düzeltmeleri
- `AGENTS.md` — ince yönlendiriciye çevrildi
