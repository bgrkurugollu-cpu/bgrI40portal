# 2026-09-03 — Bütçe kalemi düzenleme + Karlılık uyarısı

**Commit:** `eb9e5e7` · **Şema değişikliği:** ✅ var (kolon kaldırma)

## Talep
"Ödeme planını projenin düzenle menüsünden kaldır, zaten menülerde detaylıca
oluşturduk kurguyu. Bütçe kırılımında edit özelliği getir ve bu yetkiyi sadece
admine ver. Proje cirosu alanını kaldır. Karlılık %5'den düşük olursa o info
kartı kırmızı yanıp söner efekt yap, beni uyarsın!"

## Yapılanlar

- **Ödeme Planı serbest metin alanı tamamen kaldırıldı** — proje düzenleme
  formundan, detay sayfası gösteriminden, DTO'lardan, action'lardan ve
  şemadan (`Project.paymentPlanNote`). Milestone yapısı tek kaynak.
  Kaldırmadan önce production'da veri kontrolü yapıldı: **0 kayıt** → güvenli.
  Artık kullanılmayan `Textarea` bileşeni de silindi.
- **Bütçe Kırılımı'na Düzenle özelliği**: her satırda kalem artık düzenlenebilir.
  Form ayrı bir `BudgetItemForm` bileşenine taşındı (ekleme ve düzenleme aynı
  formu kullanıyor, mevcut değerlerle önceden dolu geliyor).
  Yeni server action: `updateBudgetItem()` — `requireAdmin()` korumalı.
- **Proje Cirosu kartı kaldırıldı.**
- **Karlılık uyarısı**: `StatCard`'a `warn` prop'u eklendi. Karlılık %5'in
  altındaysa kart `animate-pulse` ile yanıp söner, kenarlık/arkaplan/metin
  kırmızıya döner, alt yazı "Uyarı: %5'in altında!" olur.

## Teknik notlar

- `BudgetItemForm` `key={editingItem?.id ?? "new"}` ile remount edilir —
  aksi halde bir önceki kaydın state'i formda kalırdı.
- `StatCard` artık `Card`'a `className` geçiriyor; `Card` bileşeni
  `cn(..., className)` ile bunu zaten destekliyordu.
- Kolon silmeden önce **daima** production'da veri kontrolü yapılmalı:
  ```sql
  SELECT count(*) FROM bgrbrain."Project"
  WHERE "paymentPlanNote" IS NOT NULL AND "paymentPlanNote" != '';
  ```

## Etkilenen dosyalar
- `frontend/prisma/schema.prisma` — `paymentPlanNote` kaldırıldı
- `frontend/src/app/actions/finance.ts` — `updateBudgetItem()`
- `frontend/src/app/actions/projects.ts`, `frontend/src/lib/types.ts` — alan temizliği
- `frontend/src/app/projects/project-form.tsx` — Ödeme Planı alanı çıkarıldı
- `frontend/src/app/projects/[id]/detail-client.tsx` — `BudgetItemForm`, `StatCard.warn`
- `frontend/src/components/ui/textarea.tsx` — **silindi** (kullanılmıyor)
