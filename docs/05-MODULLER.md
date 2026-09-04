# 05 — Modül Referansı

Hangi ekran ne yapar, hangi dosyada yaşar.

## Sol menü (`components/Sidebar.tsx` + `lib/permissions.ts`)

| Menü | Rota | İzin anahtarı |
|---|---|---|
| Genel Bakış | `/` | `dashboard` |
| Projeler | `/projects` | `projects` |
| Lead / CR | `/lead-cr` | `leadcr` |
| Kaynak Planı | `/resources` | `resources` |
| Bütçe & Finans | `/finance` | `finance` |
| CAPEX Bütçesi | `/capex` | `capex` |
| Lisanslar | `/licenses` | `licenses` |

Yönetim Paneli (`/admin`) ve Hesabım (`/account`) alt menüdedir; `/admin`
middleware ile yalnızca `role === "ADMIN"`'e açıktır.

---

## Projeler / Lead-CR

**Liste:** `app/projects/projects-client.tsx`, `app/lead-cr/lead-cr-client.tsx`

- Arama, kolon bazlı sıralama.
- Satır vurguları: **Tamamlandı → yeşil**, **İptal → açık kırmızı**.
- Lead/CR listesinde risk/öncelik kolonları yoktur; "Tür" rozeti vardır.

**Detay:** `app/projects/[id]/detail-client.tsx` (ortak — Lead/CR de burayı açar)

Üstte bilgi kartları: Hedef Bütçe · Bütçe Kırılımı (TL) · **Karlılık** ·
Planlanan Efor · Gerçekleşen Efor · **Kesilmesi Gereken Gelir**.

Sekmeler:

| Sekme | İçerik | Yetki notu |
|---|---|---|
| Ekip & Efor | Kişi × ay atama matrisi; plana tıklayarak "gerçekleşti" işaretleme | Ekle/sil admin |
| Bütçe Kırılımı | Yıl bazlı kalemler, CAPEX/OPEX, TF, Excel içe/dışa aktarma | **Ekle/Düzenle/Sil/İçe aktar: yalnızca gerçek ADMIN** |
| Aylık Finans | Ay = sütun, satır = Gider / Gelir / İç Kaynak Geliri. Faturalardan otomatik | **"Düzenle" butonu yalnızca ADMIN'e görünür**, tüm ayları toplu revize eder |
| Faturalar | Tip (Gider/Gelir/İç Kaynak Geliri), eBA No, kur farkı, durum | — |
| Ödeme Planı | Yüzdelik milestone'lar; Bütçe Kırılımı toplamını böler | — |
| Proje Planı | Gantt: Ana Görev / Alt Görev, haftalık efor, JIRA kodu, Excel dışa aktarma | JIRA kodu yalnızca ADMIN |
| Değişiklik Geçmişi | `ProjectLog` kayıtları | — |

**Proje formu:** `app/projects/project-form.tsx` — Tür (Proje/Lead/CR), kodlar,
fabrikalar, hedef bütçe, tarihler, durum, JIRA linki, açıklama. Risk/Öncelik
yalnızca `kind === "PROJECT"` iken görünür.

---

## Kaynak Planı (`app/resources/`)

Kişi × ay planlanan efor matrisi. Satıra tıklayınca proje kırılımı açılır
(admin hücreleri düzenleyebilir). Sağda **Toplam** ve **Doluluk %** kolonları,
altta Ekip Toplamı ve Çalışma Günü satırları.

## Bütçe & Finans (`app/finance/`)

Şirket geneli: TCMB kur bandı, aylık gelir/gider/iç kaynak grafikleri,
proje bazlı aylık grid, faturalama takvimi. PT kayıtları da toplamlara dahildir
(`source: "PT"` ile ayırt edilir).

## Dijital CAPEX Bütçesi (`app/capex/`)

Yıllık onaylı bütçe → ana kalem → alt kalem kırılımı. Alt kalemde **arama
destekli proje seçici** (`components/ui/combobox.tsx`) vardır; proje bağlanınca
tutar TCMB kuruyla TL'ye çevrilip projenin Hedef Bütçesi'ne yazılır.
Düzenleme admine kilitlidir.

## Lisanslar (`app/licenses/`)

Uygulama/lisans envanteri, yatırım + abonelik maliyeti, yenileme takibi.

## Yönetim Paneli (`app/admin/`)

Kullanıcılar, fabrikalar, ekip üyeleri, uygulamalar; **sayfa bazlı yetki
matrisi**; Excel şablonlarıyla toplu veri yükleme (Initial Load).
