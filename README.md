# Endüstri 4.0 Yönetim Portalı — Proje, Bütçe ve Lisans Yönetimi

DBD Ekibi PO Yönetimi için entegre iç yönetim uygulaması.

## Modüller
1. **Proje ve Kaynak Yönetimi** — proje kayıtları, tarihsel değişiklik logu, risk/öncelik, aylık adam-gün planı ve plan/gerçekleşen karşılaştırması, ekip kapasite matrisi
2. **Bütçe ve Finansal Yönetim** — kırılımlı bütçe kalemleri, aylık gelir/gider/iç kaynak geliri gridi, faturalama takvimi ve nakit akışı raporu
3. **Lisans ve Key Yönetimi** — uygulama/lisans envanteri, yatırım ve abonelik maliyetleri, yenileme takibi
4. **Toplu Veri Yükleme (Initial Load)** — admin paneli üzerinden Excel (.xlsx) şablonlarıyla fabrikalar, üyeler, uygulamalar, projeler, kaynak planları, bütçeler, finans ve lisans verilerinin toplu içe aktarımı

## Teknoloji
Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS v4 · Framer Motion · Recharts · Prisma ORM · PostgreSQL 16 · JWT (HTTP-only cookie) · SheetJS (xlsx) · Docker Compose

## Çalıştırma

```bash
docker compose up --build
```

İlk açılışta bağımlılıklar kurulur, şema veritabanına uygulanır ve örnek veri yüklenir.

- Uygulama: http://localhost:3000
- PostgreSQL: localhost:5433 (bgr / bgrsecret / bgrbrain)

**Giriş:** `admin@bgr.local` / `admin123`

## Yapı

```
├── docker-compose.yml
├── database/init/          # PostgreSQL init scriptleri
└── frontend/               # Next.js full-stack uygulama
    ├── prisma/             # Şema + seed
    └── src/
        ├── app/            # Sayfalar, API route'ları, server action'lar
        ├── components/ui/  # UI bileşenleri
        ├── context/        # Auth ve tema context'leri
        └── lib/            # Prisma client, JWT, excel-helpers, yardımcılar
```
