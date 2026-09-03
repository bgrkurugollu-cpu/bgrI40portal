# 2026-08-31 — Doluluk kolonu, JIRA linkleri, Proje Planı Excel export

**Commit:** `dfa9d56` · **Şema değişikliği:** ✅ var

## Talep
Dört maddelik plan:
1. Kaynak Planı'nda her kişinin kapasite/doluluk yüzdesi, yıl sonu boşluğu ve
   dip toplamda ekip doluluk oranı.
2. Proje detayında isim/kodun altında JIRA linki (düzenle menüsünden doldurulur,
   yeni sekmede açılır).
3. Proje Planı'nın Excel (.xlsx) olarak dışa aktarılması — tüm sütun/satır ve
   Gantt yapısıyla.
4. Her ana görev/alt göreve "JIRA Kodu" alanı + backlink; **yalnızca admin**
   düzenleyebilsin.

## Yapılanlar

### 1. Kaynak Planı doluluk
"Toplam" kolonunun sağına **"Doluluk"** kolonu eklendi:
`toplam efor / yıllık çalışma günü`. %80 üzeri sarı, %100 üzeri kırmızı;
tooltip'te kalan veya aşan adam-gün. Ekip Toplamı satırına da genel doluluk
oranı eklendi (`teamCapacityYear` üzerinden).

### 2. Proje JIRA linki
`Project.jiraLink` alanı; proje formunda URL girişi; detay sayfasında başlığın
altında "JIRA'da Görüntüle" linki (`target="_blank"`). Değişiklik geçmişinde
"JIRA Linki" etiketiyle loglanır.

### 3. Proje Planı Excel export
`lib/gantt-export.ts` — `exportProjectPlanToExcel()`. Mevcut
`exportBudgetItemsToExcel` kalıbı örnek alındı:

- Sabit sütunlar: Başlık / Tip / Başlangıç / Bitiş / Süre / Atananlar / JIRA Kodu
- Ardından seçili yılın tüm ISO hafta sütunları
- Ay grubu başlıkları **birleştirilmiş hücre** (`!merges`) olarak üst satırda
- Görev satırları girintili (hiyerarşi korunur), altlarında kişi bazlı haftalık
  gün dağılımı satırları
- Otomatik kolon genişlikleri (`!cols` / `wch`)

### 4. Görev JIRA kodu (admin-only)
`ProjectTask.jiraCode` + `jiraLink`. Gantt tablosunun en sağında kolon; kod
girilince tıklanabilir linke dönüşür. Düzenleme `updateTaskJira()` ile
**gerçek ADMIN**'e kilitli (`actions/tasks.ts` içinde yerel `requireAdmin()`).

## Teknik notlar

- `isSuperAdmin` prop'u bu revizyonda tanıtıldı: `session.role === "ADMIN"`.
  `isAdmin`'den (sayfa bazlı izin) **farklıdır**.
- `/projects/[id]/page.tsx` bu yüzden `requirePageView` yerine elle
  `getSession()` + izin kontrolüne çevrildi.
- Gantt sabit kolon sayısı 6 → 7 oldu; `stickyStyle` offset'leri, `colSpan`'lar
  ve alt satırların boş hücreleri buna göre güncellendi.

## Etkilenen dosyalar
- `frontend/prisma/schema.prisma` — `Project.jiraLink`, `ProjectTask.jiraCode/jiraLink`
- `frontend/src/lib/gantt-export.ts` — **yeni**
- `frontend/src/app/resources/resources-client.tsx` — doluluk kolonu
- `frontend/src/app/projects/[id]/plan-tab.tsx` — JIRA kolonu, export butonu
- `frontend/src/app/projects/[id]/detail-client.tsx` — JIRA linki gösterimi
- `frontend/src/app/projects/project-form.tsx` — JIRA linki alanı
- `frontend/src/app/actions/tasks.ts` — `updateTaskJira()` + `requireAdmin()`
