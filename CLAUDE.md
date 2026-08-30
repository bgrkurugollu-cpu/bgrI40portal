# Teknik Mimari ve Agent Talimat Dokümanı (TECHNICAL_SPEC.md)

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
- Veritabanı: Vercel'deki `scoringv2` projesiyle **aynı paylaşılan Neon Postgres instance'ı** kullanılıyor, ama tamamen izole bir şemada — `bgrbrain` şeması. `scoringv2`'nin `public` şemasına **kesinlikle dokunulmaz** (tablo eklenmez, değiştirilmez, silinmez).
- **Şema senkron kuralı:** `frontend/prisma/schema.prisma` dosyasında bir değişiklik (yeni model, yeni alan vb.) yapılıp GitHub'a push edildiğinde, agent aynı iş kapsamında — ek onay beklemeden — bu şemayı production'daki `bgrbrain` şemasına da uygulamalıdır:
  ```bash
  docker exec -e DATABASE_URL="$(grep DATABASE_URL /Users/bugrakurugollu/bgrI40portal/.env.vercel-production | cut -d= -f2-)" bgr-brain-app npx prisma db push
  ```
  (Local `bgr-brain-app` container'ı üzerinden çalıştırılır çünkü host makinede node/npx yok. Container ayakta değilse `docker compose up -d` ile kaldırılır.)
- Bu komutun kullandığı `DATABASE_URL`, repoya **asla girmeyen**, `.gitignore`'da olan `.env.vercel-production` dosyasından okunur (GitHub reposu **public** olduğu için bu secret hiçbir committed dosyaya yazılmaz — ne CLAUDE.md'ye ne başka bir dosyaya). Bu dosya yoksa veya değer geçersizse, agent DURUP kullanıcıdan Vercel dashboard'undaki (`i40-portal` → Settings → Environment Variables → `DATABASE_URL`) güncel değeri ister.
- Veri (satırlar) migration'ı bu kuralın kapsamında DEĞİL — sadece şema (tablo/kolon yapısı) senkron tutulur. Gerçek veri taşıma/senkronizasyonu ayrı, bilinçli bir işlemdir ve kullanıcı özellikle istemeden yapılmaz.
