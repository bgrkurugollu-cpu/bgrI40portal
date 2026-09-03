# 2026-08-31 — Yeni Lead / CR modülü

**Commit:** `e8cbec6` · **Şema değişikliği:** ✅ var

## Talep
"Lead/CR projelerimiz var — proje veya demand olmayan, belli bir kapsamın
dışındaki işler. Her projeyi Lead ve CR olarak işaretleyebilmeliyim. Projeler
kısmındaki yapıyı komple koruyacaksın (proje planı, ödeme, ekip efor, JIRA
kodu). Sadece bunlar ayrıştırılacak ve yeni bir menüde gösterilecek.
Risk, öncelik gerek yok — sadece durumu görsem yeterli."

## Yapılanlar

- **`ProjectKind` enum'u** (`PROJECT` | `LEAD` | `CR`) ve `Project.kind` alanı.
  Mevcut 47 proje otomatik `PROJECT` oldu (varsayılan değer), veri kaybı yok.
- Proje formuna **"Tür"** seçici eklendi. Herhangi bir kayıt istenildiği an
  Proje ↔ Lead ↔ CR arasında taşınabiliyor; tür değişince kayıt otomatik olarak
  diğer menüde görünüyor.
- **Yeni menü:** `/lead-cr` (`Flag` ikonu). `lib/permissions.ts`'e `leadcr`
  anahtarı eklendiği için admin panelindeki yetki matrisine otomatik düştü.
- Lead/CR listesi Projeler listesinin birebir aynısı, farkları: "Tür" rozeti
  var, **Risk/Öncelik/İhtimal kolonları yok**.
- **Detay sayfası ortak** (`/projects/[id]`): Lead/CR de aynı sayfayı açar,
  tüm sekmeler (Proje Planı, Faturalar, Ekip & Efor, Bütçe...) aynen çalışır.
  "Geri" linki `kind`'e göre doğru listeye döner, başlıkta tür rozeti çıkar,
  Risk/Öncelik rozetleri gizlenir.
- Proje formunda Risk/Öncelik alanları yalnızca `kind === "PROJECT"` iken
  görünür.
- Dashboard proje sayımları artık yalnızca `kind: PROJECT` sayıyor.

## Teknik notlar

Aynı model iki menüyü beslediği için yetki kontrolü `kind`'e göre dallanır:

```ts
function pageForKind(kind: ProjectKind): "projects" | "leadcr" {
  return kind === "PROJECT" ? "projects" : "leadcr";
}
```

`updateProject` içinde tür değiştiriliyorsa **hem kaynak hem hedef** menü için
düzenleme izni aranır. Detay sayfasında da izin `kind` okunduktan **sonra**
kontrol edilir (bu yüzden `requirePageView` yerine elle `getSession()` +
`getEffectivePermission()` kullanılır).

## Etkilenen dosyalar
- `frontend/prisma/schema.prisma` — `ProjectKind` + `Project.kind`
- `frontend/src/app/lead-cr/page.tsx`, `lead-cr-client.tsx` — **yeni**
- `frontend/src/lib/permissions.ts` — `leadcr` sayfası
- `frontend/src/components/Sidebar.tsx` — menü girişi
- `frontend/src/app/actions/projects.ts` — `pageForKind()`, izin dallanması
- `frontend/src/app/projects/project-form.tsx` — Tür seçici, koşullu risk/öncelik
- `frontend/src/app/projects/[id]/detail-client.tsx`, `page.tsx`
- `frontend/src/app/page.tsx` — dashboard `kind: PROJECT` filtresi
