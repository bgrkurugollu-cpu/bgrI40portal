# 2026-09-04 — lead cr cr kaldirma proje kodu opsiyonel

**Commit:** `f617a85` · **Şema değişikliği:** yok

## Talep
Lead/CR ekranında CR diye bir fonksiyon artık istenmiyor — yeni kayıt açarken CR seçeneği hiç
görünmemeli. Aynı ekranda "Tür" alanında Proje seçeneği de görünüyordu, o da kaldırılmalı;
Lead/CR sayfasından yalnızca Lead açılabilmeli. Ayrıca yalnızca Lead için Proje Kodu zorunlu
olmaktan çıkarılmalı, Projeler sayfasında ise mevcut zorunluluk (as-is) korunmalı.

## Yapılanlar
- Lead/CR ekranında yeni kayıt için CR türü ve Proje seçeneği kaldırıldı (yalnızca Lead açılabiliyor); Lead kayıtlarında Proje Kodu artık zorunlu değil (boş bırakılırsa otomatik kod atanır), Projeler tarafında zorunluluk aynı kalıyor

## Teknik notlar
- `Project.projectCode` DB'de hâlâ `String @unique` (NOT NULL) — **şema değiştirilmedi**, bilinçli tercih: bu alanı nullable yapmak `dashboard-client.tsx`, `capex`, `finance`, `resources`, `gantt-export.ts` gibi onlarca yerde `string` varsayımını kırıp geniş bir refactor gerektirirdi. Bunun yerine Lead'de kod boş bırakılırsa `createProject`/`updateProject` içinde ([projects.ts](../../frontend/src/app/actions/projects.ts)) `autoLeadCode()` ile `LEAD-XXXXXXXX` (rastgele 8 hex, `crypto.randomUUID()`) biçiminde bir kod otomatik üretiliyor — DB kısıtı hep dolu kalıyor, kullanıcı hiç kod girmek zorunda kalmıyor.
- `ProjectForm`'a `allowedKinds` prop'u eklendi ([project-form.tsx](../../frontend/src/app/projects/project-form.tsx)): Lead/CR sayfası `allowedKinds={["LEAD"]}` geçiyor, Projeler sayfası varsayılan `["PROJECT","LEAD"]`'i kullanıyor (CR hiçbir yerde artık seçenek değil). Seçenek sayısı 1'e düşünce (yalnızca Lead) "Tür" dropdown'ı tamamen gizleniyor.
- **Geriye dönük uyumluluk / veri kaybı yok:** Prisma şemasındaki `ProjectKind` enum'ından `CR` **silinmedi** — mevcut CR kayıtları (varsa) DB'de ve Lead/CR tablosunda (`page.tsx`'teki `kind: { in: ["LEAD","CR"] }` sorgusu değişmedi) görünmeye devam ediyor, sadece yeni kayıt olarak seçilemiyor. Eski bir CR kaydı düzenlenirken `ProjectForm` mevcut `kind` değerini `allowedKinds` listesine otomatik ekliyor (`kindOptions` hesaplaması) — böylece dropdown sessizce Lead'e çevirmiyor, kaydın gerçek türünü koruyor.
- `codeRequired = kind !== "LEAD"` — form içinde Tür anlık değiştirildiğinde (ör. Proje→Lead) "Proje Kodu" alanının `required` durumu da anında güncelleniyor.

## Etkilenen dosyalar
- `frontend/src/app/actions/projects.ts`
- `frontend/src/app/lead-cr/lead-cr-client.tsx`
- `frontend/src/app/projects/project-form.tsx`
