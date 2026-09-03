# Teknik Mimari ve Agent Talimat Dokümanı (TECHNICAL_SPEC.md)

> ## 📖 ÖNCE BUNU OKU → [`docs/00-BASLANGIC.md`](docs/00-BASLANGIC.md)
>
> `docs/` klasörü projenin **kalıcı hafızasıdır**: canlı ortam, veritabanı,
> deploy zinciri, kod kalıpları, iş kuralları ve tüm değişiklik geçmişi orada
> güncel tutulur. Kod tabanını keşfetmeye başlamadan önce oradan oku —
> zaman/token kaybını önler.
>
> | | |
> |---|---|
> | Başlangıç (yeni sohbet) | [`docs/00-BASLANGIC.md`](docs/00-BASLANGIC.md) |
> | Mimari & kod kalıpları | [`docs/01-MIMARI.md`](docs/01-MIMARI.md) |
> | Deploy & veritabanı | [`docs/02-DEPLOYMENT.md`](docs/02-DEPLOYMENT.md) |
> | Veri modeli & iş kuralları | [`docs/03-VERI-MODELI.md`](docs/03-VERI-MODELI.md) |
> | Çalışma akışı & kayıt tutma | [`docs/04-CALISMA-AKISI.md`](docs/04-CALISMA-AKISI.md) |
> | Modül referansı | [`docs/05-MODULLER.md`](docs/05-MODULLER.md) |
> | Değişiklik günlüğü | [`docs/degisiklikler/`](docs/degisiklikler/README.md) |
>
> **Kural:** Her commit + push sonrası `docs/degisiklikler/` altına kayıt düşülür
> (bkz. `docs/04-CALISMA-AKISI.md` §7 — `yeni-kayit.sh` bunu otomatikleştirir).

## 1. Proje Genel Bakışı ve Hedef
Bu doküman; Proje Yönetimi (Gantt/Proje Planı dahil), PT Kodları, Bütçe Takibi (Ödeme Planı, Dijital CAPEX Bütçesi dahil), Lisans Yönetimi ve kullanıcı bazlı sayfa erişim yetkilendirmesi modüllerinden oluşan entegre bir iç yönetim uygulamasının teknik mimarisini ve otonom geliştirme ajanı (Agent) için uygulama talimatlarını içerir. Uygulama, Docker üzerinde çalışacak, verilerini PostgreSQL'de tutacak ve modern, ferah, yüksek etkileşimli bir ön yüze sahip olacaktır.

---

## 2. Teknoloji Yığını (Tech Stack)
Agent, projeyi oluştururken aşağıdaki modern ve sürdürülebilir teknoloji yığınını kullanmalıdır:
* **Konteynerleştirme:** Docker & Docker Compose
* **Ön Yüz (Frontend):** Next.js (App Router) veya Vite + React, TypeScript, Tailwind CSS, Shadcn/ui (Bileşen kütüphanesi), Framer Motion (Mikro etkileşimler ve animasyonlar), Recharts veya Chart.js (Modern veri görselleştirme)
* **Arka Yüz (Backend):** Next.js Server Actions / API Routes veya FastAPI (Python)
* **Veritabanı & ORM:** PostgreSQL, Prisma ORM veya Drizzle ORM
* **Kimlik Doğrulama:** JWT tabanlı, HTTP-only cookie mekanizmalı güvenli auth yapısı

---

## 3. Mimari ve Klasör Yapısı
Proje, mikroservis karmaşasından uzak, monorepo veya temiz ayrıştırılmış tek bir Docker Compose yapısında kurulmalıdır:
```text
/
├── docker-compose.yml
├── database/init/ (PostgreSQL init scriptleri)
└── frontend/
    ├── src/
    │   ├── components/ui/ (Shadcn bileşenleri)
    │   ├── context/ (Auth ve Tema yönetimleri)
    │   ├── hooks/
    │   └── app/ (veya pages/)

---

## 4. Temel Geliştirme Prensibi ve GitHub Push Talimatı
Agent, kullanıcıyla çalışırken aşağıdaki temel kurala uymak zorundadır:
- **Lokalde yapılan her geliştirme tamamlandıktan sonra, ek bir komut veya onay beklemeden doğrudan şu komut zinciriyle GitHub'a gönderilir:**

```bash
git add . && git commit -m "Değişiklik açıklaması" && git push
```

- Commit mesajı Türkçe ve yapılan değişikliği net anlatan tek satır olmalıdır.
- Bu, her başarılı özellik eklemesi, hata çözümü veya doküman güncellemesinden sonra sistemin otomatik olarak uzak sunucuya yedeklenmesi (sürekli entegrasyon mantığı) için zorunludur.
- Push öncesi onay sorulmaz; iş biter bitmez push edilir.

### 4.1 VERİ GİZLİLİĞİ KURALI — Excel verileri asla push edilmez
- **Excel verileri (`.xlsx`, `.xls`, `.xlsm`) HİÇBİR ŞEKİLDE GitHub'a push edilmez.** Bu dosyalar özel/kurumsal veri içerir.
- Bu kural, doldurulmuş "Veri Çek" şablonları (`frontend/prisma/seed-data/*.xlsx`) ve yerel DB dump'ı (`/seed/`) dahil olmak üzere tüm veri dosyalarını kapsar.
- Koruma `.gitignore` ile sağlanır: `*.xlsx`, `*.xls`, `*.xlsm`, `/seed/`, `.env` hariç tutulmuştur. `git add .` bu dosyaları kapsamaz.
- Bu nedenle agent, `git add .` kullanmadan önce **`.gitignore` kurallarının yerinde olduğundan emin olmalı**; yeni bir veri dosyası türü ortaya çıkarsa önce `.gitignore`'a eklemeli, sonra commit etmelidir.
- Commit sonrası şüphe varsa `git show --stat HEAD` ile hangi dosyaların gittiği doğrulanmalıdır.
- Boş şablonlar gerektiğinde `frontend/prisma/generate-templates.ts` ile yeniden üretilir (veri içermez).

### 4.2 VERCEL PRODUCTION DEPLOYMENT — kod ve veritabanı şeması otomatik senkron
- Uygulamanın Vercel'de canlı bir kopyası var: proje `i40-portal` (takım `bgr`/`bgr14`), domain `i40-portal.vercel.app` (custom domain kullanılmıyor, kasıtlı). Bu proje GitHub'daki `main` branch'ine bağlı — 4. maddedeki `git push` otomatik olarak Vercel'de yeni bir production deployment tetikler, ekstra bir işlem gerekmez.
- Veritabanı: kendine ait, ayrı bir Neon Postgres instance'ı — `I40DB` (2026-08-30'a kadar `scoringv2` ile paylaşılan tek bir instance kullanılıyordu; veri bu tarihte tamamen `I40DB`'ye taşındı ve projeler birbirinden ayrıldı). Veriler yine `bgrbrain` şemasında tutuluyor (isimlendirme korundu, ama artık başka hiçbir projeyle paylaşılmıyor).
- **Şema senkron kuralı:** `frontend/prisma/schema.prisma` dosyasında bir değişiklik (yeni model, yeni alan vb.) yapılıp GitHub'a push edildiğinde, agent aynı iş kapsamında — ek onay beklemeden — bu şemayı production'daki `bgrbrain` şemasına da uygulamalıdır:
  ```bash
  cd /Users/bugrakurugollu/Desktop/i40portal/frontend
  DATABASE_URL="$(grep DATABASE_URL ../.env.vercel-production | cut -d= -f2-)" npx prisma db push --skip-generate
  ```
  (Bu makinede `node`/`npx` mevcut — doğrudan host'tan çalıştırılır, Docker container'ına gerek yok.)
- Bu komutun kullandığı `DATABASE_URL`, repoya **asla girmeyen**, `.gitignore`'da olan `.env.vercel-production` dosyasından okunur (GitHub reposu **public** olduğu için bu secret hiçbir committed dosyaya yazılmaz — ne CLAUDE.md'ye, ne `docs/`'a, ne başka bir dosyaya). Dosya bu MacBook Pro'da ve Mac mini'de mevcuttur; başka bir makinede yoksa Vercel'deki değer **Secret tipi olduğu için geri okunamaz** — Neon konsolundan connection string yeniden alınmalı ya da kullanıcıdan istenmelidir.
- Kolon/tablo **silen** bir şema değişikliğinde, push'tan önce production'da o alanda veri olup olmadığı kontrol edilir.
- Veri (satırlar) migration'ı bu kuralın kapsamında DEĞİL — sadece şema (tablo/kolon yapısı) senkron tutulur. Gerçek veri taşıma/senkronizasyonu ayrı, bilinçli bir işlemdir ve kullanıcı özellikle istemeden yapılmaz.
- **2026-08-30 not:** Eski paylaşılan instance'taki (`scoringv2`'nin Neon projesi, host `ep-cold-recipe-au4bxz0k-pooler...`) `bgrbrain` şeması, veri `I40DB`'ye taşındıktan sonra da kullanıcı isteğiyle **geçici olarak silinmeden bırakıldı** (yedek amaçlı). Kullanıcı ayrıca talimat verene kadar bu şemaya dokunulmamalı; silme talimatı gelirse `DROP SCHEMA bgrbrain CASCADE` ile temizlenebilir.

### 4.3 DEĞİŞİKLİK KAYDI — her commit `docs/degisiklikler/` altına işlenir
- Her başarılı commit+push sonrası, agent **ek onay beklemeden** değişikliği [`docs/degisiklikler/`](docs/degisiklikler/README.md) altına kaydeder. Bu, projenin kalıcı hafızasıdır ve yeni sohbetlerde bağlamı sıfırdan keşfetme maliyetini ortadan kaldırır.
- **Her zaman:** `docs/degisiklikler/README.md` içindeki tablonun en üstüne yeni commit satırı eklenir.
- **Anlamlı işlerde** (yeni modül, iş kuralı değişikliği, altyapı/DB işlemi) ayrıca `YYYY-AA-GG-kisa-baslik.md` detay dosyası açılır: Talep / Yapılanlar / Teknik notlar / Etkilenen dosyalar.
- Otomatikleştirme: `./docs/degisiklikler/yeni-kayit.sh "kisa-baslik"` son commit'i okuyup tablo satırını ve şablon dosyayı üretir.
- Commit'siz altyapı işlemleri de (DB taşıma, geriye dönük veri düzeltme, Vercel ayarı) README'deki ayrı tabloya yazılır.
- `docs/` klasörüne **hiçbir secret yazılmaz** — repo public'tir.
