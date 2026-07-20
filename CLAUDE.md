# Teknik Mimari ve Agent Talimat Dokümanı (TECHNICAL_SPEC.md)

## 1. Proje Genel Bakışı ve Hedef
Bu doküman; Proje Yönetimi, Bütçe Takibi ve Lisans Yönetimi modüllerinden oluşan entegre bir iç yönetim uygulamasının teknik mimarisini ve otonom geliştirme ajanı (Agent) için uygulama talimatlarını içerir. Uygulama, Docker üzerinde çalışacak, verilerini PostgreSQL'de tutacak ve modern, ferah, yüksek etkileşimli bir ön yüze sahip olacaktır.

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
- **Tüm işlemleri ve kod geliştirmelerini tamamladıktan sonra, ek bir komut veya onay beklemeden ilgili değişiklikleri GitHub reposuna `commit` ve `push` etmelidir.**
- Bu, her başarılı özellik eklemesi, hata çözümü veya doküman güncellemesinden sonra sistemin otomatik olarak uzak sunucuya yedeklenmesi (sürekli entegrasyon mantığı) için zorunludur.

### 4.1 VERİ GİZLİLİĞİ KURALI — Excel verileri asla push edilmez
- **Excel verileri (`.xlsx`, `.xls`, `.xlsm`) HİÇBİR ŞEKİLDE GitHub'a push edilmez.** Bu dosyalar özel/kurumsal veri içerir.
- Bu kural, doldurulmuş "Veri Çek" şablonları (`frontend/prisma/seed-data/*.xlsx`) ve yerel DB dump'ı (`/seed/`) dahil olmak üzere tüm veri dosyalarını kapsar.
- Bu dosyalar `.gitignore` ile hariç tutulmuştur; agent commit/push yaparken **yalnızca kod ve doküman** değişikliklerini stage etmeli, hiçbir zaman `git add -A`/`git add .` ile veri dosyalarını dahil etmemelidir.
- Boş şablonlar gerektiğinde `frontend/prisma/generate-templates.ts` ile yeniden üretilir (veri içermez).