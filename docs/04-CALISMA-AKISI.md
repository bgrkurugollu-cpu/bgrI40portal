# 04 — Çalışma Akışı ve Kayıt Tutma

## Bir revizyonun tam yaşam döngüsü

### 1. Anla
Kullanıcı revizyonu sohbette tarif eder. Belirsizse sor; net ise **sorma, yap**.
Kullanıcı "planı harfiyen uygula" dediyse soru sormadan uygula.

### 2. Keşfet (gerekiyorsa)
Bu `docs/` klasörü çoğu şeyi zaten anlatır. Yetmezse hedefli okuma yap.
Çok geniş bir alanı taramak gerekiyorsa `Explore` alt-ajanı kullanılabilir.

### 3. Uygula
Kod kalıpları için → [`01-MIMARI.md`](01-MIMARI.md).
Şemaya alan eklerken 4 yeri birden güncellemeyi unutma.

### 4. Doğrula (atlanamaz)

```bash
cd /Users/bugrakurugollu/Desktop/i40portal/frontend
npx prisma generate     # şema değiştiyse
DATABASE_URL="postgresql://user:pass@localhost:5432/db" JWT_SECRET="test" npm run build
```

Build temiz değilse commit yok.

### 5. Production DB'yi senkronla (şema değiştiyse)

```bash
DATABASE_URL="$(grep DATABASE_URL ../.env.vercel-production | cut -d= -f2-)" \
  npx prisma db push --skip-generate
```

Kolon **siliyorsan** önce içinde veri var mı bak (bkz. `02-DEPLOYMENT.md`).

### 6. Commit + push

```bash
cd /Users/bugrakurugollu/Desktop/i40portal
git add <değişen dosyalar>          # `git add .` yerine açıkça listele
git commit -m "Türkçe, tek satır, ne yapıldığını net anlatan mesaj"
git push
```

Push öncesi onay sorulmaz (CLAUDE.md §4).

### 7. Kaydı düş ⭐

`docs/degisiklikler/` altına gir:

1. **Her zaman:** [`degisiklikler/README.md`](degisiklikler/README.md) tablosunun
   **en üstüne** yeni commit satırını ekle.
2. **Anlamlı bir iş ise** (yeni modül, iş kuralı değişikliği, altyapı):
   `YYYY-AA-GG-kisa-baslik.md` dosyası aç ve şablonu doldur.
   Küçük düzeltmeler için sadece tablo satırı yeterli.

Kolaylık için:

```bash
./docs/degisiklikler/yeni-kayit.sh "kisa-baslik"
```

Bu script son commit'i okur, tablo satırını otomatik ekler ve şablondan
doldurulmuş bir `.md` dosyası oluşturur.

### 8. Canlıyı doğrula

Push'tan ~1-2 dk sonra Vercel deploy'u biter. Sağlık kontrolü için
`02-DEPLOYMENT.md`'deki `curl` komutu. İçerik doğrulaması giriş gerektirir —
gerekirse kullanıcıdan ekran görüntüsü iste.

## Kayıt dosyası şablonu

```markdown
# YYYY-AA-GG — <Başlık>

**Commit:** `<hash>` · **Talep eden:** Buğra · **Şema değişikliği:** var/yok

## Talep
<Kullanıcının kendi ifadesiyle ne istediği>

## Yapılanlar
- ...

## Teknik notlar
<Formül, kural, tuzak — gelecekte hatırlanması gerekenler>

## Etkilenen dosyalar
- `path/to/file.ts` — ne değişti
```

## Yapılmayacaklar

- ❌ Secret'ı commit'lenen bir dosyaya yazmak
- ❌ Build çalıştırmadan push etmek
- ❌ Şema değiştirip production DB'yi senkronlamayı unutmak
- ❌ Kullanıcı istemeden veri (satır) silmek/taşımak
- ❌ `scoringv2`'nin veritabanına dokunmak
- ❌ Commit'i changelog'a işlemeden bırakmak
