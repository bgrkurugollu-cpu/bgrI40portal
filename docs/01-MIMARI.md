# 01 — Mimari ve Kod Kalıpları

## Teknoloji yığını

| Katman | Teknoloji |
|---|---|
| Framework | **Next.js 15** (App Router, Server Actions, `output: "standalone"`) |
| Dil | TypeScript |
| UI | Tailwind CSS v4, Framer Motion, lucide-react ikonlar |
| Grafik | Recharts |
| ORM / DB | Prisma 6 + PostgreSQL (Neon) |
| Auth | JWT (`jose`) + HTTP-only cookie |
| Excel | SheetJS (`xlsx`) |
| Hosting | Vercel (production), Docker Compose (local geliştirme) |

## Klasör haritası

```
i40portal/
├── CLAUDE.md               # Agent talimatları (push kuralı, veri gizliliği, prod DB)
├── docs/                   # ← BU KLASÖR (kalıcı proje hafızası)
├── docker-compose.yml      # Local geliştirme (Postgres + app)
├── .env.vercel-production  # 🔒 prod DATABASE_URL (gitignore'da)
└── frontend/
    ├── prisma/
    │   ├── schema.prisma   # Tüm veri modeli
    │   └── seed.ts
    └── src/
        ├── app/
        │   ├── page.tsx            # Dashboard (Genel Bakış)
        │   ├── actions/            # ⭐ Tüm server action'lar
        │   │   ├── projects.ts     #   proje CRUD, atama (Assignment)
        │   │   ├── finance.ts      #   bütçe kalemi, fatura, aylık finans, ödeme milestone
        │   │   ├── tasks.ts        #   Gantt görevleri, haftalık efor dağılımı
        │   │   ├── capex.ts        #   CAPEX bütçesi
        │   │   ├── licenses.ts / admin.ts / account.ts / bulk-import.ts
        │   ├── projects/           # Projeler listesi + [id] detay
        │   │   ├── project-form.tsx        # Proje ekle/düzenle formu (Lead/CR ile ortak)
        │   │   └── [id]/
        │   │       ├── page.tsx            # Server component — tüm DTO'ları kurar
        │   │       ├── detail-client.tsx   # ⭐ Proje detayı, tüm sekmeler (büyük dosya)
        │   │       └── plan-tab.tsx        # Proje Planı (Gantt) sekmesi
        │   ├── lead-cr/            # Lead/CR listesi (Projeler ile aynı modeli kullanır)
        │   ├── resources/          # Kaynak Planı (kişi × ay efor matrisi)
        │   ├── finance/            # Şirket geneli finans
        │   ├── capex/              # Dijital CAPEX Bütçesi
        │   ├── licenses/ admin/ account/ login/
        ├── components/
        │   ├── AppShell.tsx, Sidebar.tsx   # Menü (yeni sayfa eklerken burayı güncelle)
        │   └── ui/                         # Ortak bileşenler
        └── lib/
            ├── types.ts            # ⭐ Tüm DTO tipleri (client'a geçen düz veriler)
            ├── utils.ts            # formatMoney, etiket sabitleri, MONTHS_TR...
            ├── permissions.ts      # ⭐ APP_PAGES — sayfa kaydı + varsayılan izinler
            ├── permission-guard.ts # requirePageView / requirePageEdit
            ├── auth.ts, session.ts # JWT oturum
            ├── rates.ts            # TCMB döviz kurları (saatlik cache) + toTRY()
            ├── isoweek.ts          # Gantt ISO hafta hesapları
            ├── workdays.ts         # Aylık çalışma günü (resmi tatil/köprü düşülmüş)
            ├── gantt-export.ts     # Proje Planı → Excel
            └── budget-import.ts    # Bütçe kırılımı Excel içe/dışa aktarma
```

## Kod kalıpları (yeni kod yazarken bunlara uy)

### 1. Server Component → DTO → Client Component

Prisma nesneleri (Decimal, Date) client'a **doğrudan geçmez**. `page.tsx`
içinde düz DTO'ya çevrilir, tip `lib/types.ts`'te tanımlıdır.

```ts
// app/projects/[id]/page.tsx
const dto: ProjectDTO = {
  ...,
  targetBudget: Number(project.targetBudget),          // Decimal → number
  startDate: project.startDate?.toISOString().slice(0, 10) ?? null,  // Date → "YYYY-MM-DD"
};
```

> **Yeni alan eklerken 4 yeri birden güncelle:** `schema.prisma` → `lib/types.ts`
> → ilgili `page.tsx` DTO kurulumu → form/UI. Build bunu yakalar.

### 2. İki kademeli yetki

```ts
// Esnek: admin panelinden sayfa bazlı verilebilir
await requirePageEdit("projects");

// Katı: yalnızca gerçek ADMIN rolü (finance.ts / tasks.ts içinde tanımlı)
await requireAdmin();
```

`requireAdmin()` kullanan yerler: bütçe kalemi ekle/düzenle/sil/içe-aktar,
aylık finans manuel düzenleme, görev JIRA kodu.

Client tarafında karşılığı: `isSuperAdmin` prop'u (butonları gizler).
**Sunucu kontrolü şart** — arayüzde gizlemek tek başına yeterli değil.

### 3. Server action sonrası cache temizleme

```ts
revalidatePath(`/projects/${projectId}`);
revalidatePath("/finance");
revalidatePath("/");
```

### 4. Yeni sayfa/menü ekleme

1. `lib/permissions.ts` → `APP_PAGES` dizisine kaydı ekle (admin paneli otomatik alır)
2. `components/Sidebar.tsx` → `nav` dizisine ikon + link ekle
3. `app/<sayfa>/page.tsx` → `requirePageView("<key>")` ile koru

### 5. Para birimi

Kalemler farklı para biriminde olabilir. Raporlamada **daima TL karşılığı**
kullanılır: `toTRY(amount, currency, rates)` — kurlar `lib/rates.ts`'ten
(TCMB, saatlik cache, erişilemezse yedek kur).

### 6. Dialog içindeki formlar

State'in eski kayıttan kalmaması için form gövdesi ayrı bir bileşene alınır ve
`key={item?.id ?? "new"}` ile remount edilir. (Sadece `<form key>` yetmez —
üstteki `useState`'ler sıfırlanmaz.)
