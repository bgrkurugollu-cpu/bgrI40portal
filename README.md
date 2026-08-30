# Endüstri 4.0 Yönetim Portalı — Proje, Bütçe ve Lisans Yönetimi

DBD Ekibi PO Yönetimi için entegre iç yönetim uygulaması.

## Modüller
1. **Proje ve Kaynak Yönetimi** — proje kayıtları (proje kodu + Pipeline Kodu/PTM), tarihsel değişiklik logu, risk/öncelik, ekip kapasite matrisi (kişi × ay), plan/gerçekleşen karşılaştırması (kullanıcı kendi eforunu "gerçekleşti" olarak işaretleyebilir)
2. **Proje Planı (Gantt)** — proje bazında görev/milestone/alt görev kırılımı, yıllık ISO hafta takvimi üzerinde renkli Gantt çubukları, kişi ataması ve haftalık gün girişi; girilen günler otomatik olarak Kaynak Planı'na (aylık plan) yansır
3. **PT Kodları** — projelerden ayrı, kendi fatura ve aylık finans takibini (gider + %5 gelir kuralı) yapan PT kayıtları; Finans ve Dashboard toplamlarına dahildir
4. **Bütçe ve Finansal Yönetim** — kırılımlı bütçe kalemleri, aylık gelir/gider/iç kaynak geliri gridi, faturalama takvimi (eBA No zorunlu, kur farkı eBA No takibi), Ödeme Planı ve nakit akışı raporu (Proje/PT kırılımlı)
5. **Dijital CAPEX Bütçesi** — yıllık onaylı CAPEX bütçesinin ana kalem → alt proje kırılımı, kalan/aşım takibi, dashboard KPI ve grafikleri
6. **Lisans ve Key Yönetimi** — uygulama/lisans envanteri, yatırım ve abonelik maliyetleri, yenileme takibi
7. **Kullanıcı Yönetimi ve Sayfa Bazlı Erişim Yetkileri** — admin panelinden her kullanıcı için sayfa bazında görüntüleme/düzenleme yetkisi tanımlanabilir (`src/lib/permissions.ts`, `src/lib/permission-guard.ts`); varsayılan davranış geriye dönük uyumludur (kayıt yoksa eski açık/kapalı kurallar geçerli)
8. **Toplu Veri Yükleme (Initial Load)** — admin paneli üzerinden Excel (.xlsx) şablonlarıyla fabrikalar, üyeler, uygulamalar, projeler, kaynak planları, bütçeler, finans ve lisans verilerinin toplu içe aktarımı

## Teknoloji
Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS v4 · Framer Motion · Recharts · Prisma ORM · PostgreSQL 16 · JWT (HTTP-only cookie) · SheetJS (xlsx) · Docker Compose

## Çalıştırma

```bash
docker compose up --build
```

İlk açılışta bağımlılıklar kurulur, şema veritabanına uygulanır ve örnek veri yüklenir.

- Uygulama: http://localhost:3000
- PostgreSQL: localhost:5433 (kullanıcı `bgr`, DB `bgrbrain`, şifre `.env`'deki `POSTGRES_PASSWORD`)

**Giriş:** İlk seed'de `admin@bgr.local` için rastgele bir şifre üretilir ve terminale bir kez yazdırılır (`docker compose logs app` ile görülebilir). İlk girişten sonra Hesap sayfasından değiştirin.

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
