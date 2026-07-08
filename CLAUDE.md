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
├── backend/ (Eğer Next.js full-stack seçilmediyse)
├── frontend/
│   ├── src/
│   │   ├── components/ui/ (Shadcn bileşenleri)
│   │   ├── context/ (Auth ve Tema yönetimleri)
│   │   ├── hooks/
│   │   └── app/ (veya pages/)
└── database/ (PostgreSQL init scriptleri)