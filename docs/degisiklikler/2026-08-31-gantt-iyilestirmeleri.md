# 2026-08-31 — Gantt iyileştirmeleri (milestone çubuğu + hiyerarşi)

**Commit:** `2c839b4` · **Şema değişikliği:** yok

## Talep
1. Excel butonu "Aktar" değil **"Dışa Aktar"** olsun.
2. "Milestone eklediğimde Gantt'ta başlangıç–bitiş arasında uzamıyor, tek
   haftaya nokta gibi koyuyorsun. Task'taki gibi görev süresince uzatman lazım."
3. "Milestone ana görev, altındaki task alt görev olacak — proje planına bu
   gözle yaklaş."

## Yapılanlar

- Buton metni → "Excel'e Dışa Aktar".
- **Milestone çubuğu artık süre boyunca uzuyor.** Eskiden yalnızca başlangıç
  haftasında 3×3 px döndürülmüş bir kare çiziliyordu; artık görevlerdeki gibi
  tüm hafta aralığını kaplayan bir çubuk — ama kesikli kenarlık
  (`border-2 border-dashed`) ve yarı saydam dolgu (`${color}55`) ile alt
  görevden görsel olarak ayrılıyor. Excel export'unda karşılığı `◇`.
- **Hiyerarşi zorunlu kılındı:** yeni kayıt oluştururken tip artık serbest
  değil — üst düzeyde eklenen `MILESTONE`, bir milestone'un altına eklenen
  `TASK`. Tip seçici bu durumlarda kilitli, formda açıklayıcı not var.
  "+" (alt görev ekle) ikonu **yalnızca milestone satırlarında** görünür.
- Mevcut/geçmiş kayıtlar korundu: bir kaydı *düzenlerken* tip hâlâ serbest
  (geriye dönük veri bozulmasın diye).

## Teknik notlar

```ts
// Yeni kayıtta tip, konuma göre sabitlenir
const lockedType = !task ? (parentId ? "TASK" : "MILESTONE") : null;
```

`Select` bileşeni `disabled` prop'unu destekliyor; kilitli durumda `name`
verilmediği için FormData'ya girmiyor — değer `useState`'ten okunuyor.

## Etkilenen dosyalar
- `frontend/src/app/projects/[id]/plan-tab.tsx`
- `frontend/src/lib/gantt-export.ts`
