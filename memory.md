# Endüstri 4.0 Yönetim Portalı Proje Analizi ve Fonksiyon Hafızası (Memory)

Bu doküman, projenin detaylı mimari analizini ve projedeki **tüm arka uç, veritabanı, yardımcı araç ve yönlendirme (route)** fonksiyonlarının %100'ünün çalışma mantıklarını içermektedir. Bu sayede projenin tam kapsamlı teknik hafızası oluşturulmuştur.

## 1. Proje Mimarisi ve Genel Bakış

Proje; Next.js (App Router), Prisma ORM, PostgreSQL ve Tailwind CSS kullanılarak geliştirilmiş monolitik bir iç yönetim uygulamasıdır. Proje 3 ana modülden oluşur:
1. **Proje ve Kaynak Yönetimi:** Proje oluşturma, tarihsel değişiklik logları, takım üyelerinin adam-gün efor atamaları.
2. **Bütçe ve Finansal Yönetim:** Projelere ait gelir, gider, bütçe kalemleri ve fatura yönetimi. (Gelirler giderlerin %5 fazlası olarak otomatik hesaplanır).
3. **Lisans ve Key Yönetimi:** Kullanılan uygulama lisansları, maliyetleri, yenileme tarihleri ve fabrikalara göre atamaları.

Ayrıca, TCMB üzerinden kur verisi çekilerek finansal analizler TL bazında raporlanabilmektedir. Kimlik doğrulama işlemi (Authentication) JWT tabanlı HttpOnly çerezlerle yapılmaktadır.

---

## 2. Server Actions (Veritabanı İşlemleri)

Projedeki iş mantığını yürüten tüm `use server` fonksiyonları aşağıdaki gibidir:

### `src/app/actions/projects.ts`
- **`createProject(input: ProjectInput)`**: Sisteme yeni bir proje ekler. Tarihler (startDate, endDate) JS Date nesnesine çevrilir. Proje yaratıldıktan sonra `ProjectLog` tablosuna "oluşturma" işlemi kaydedilir. `/projects` ve `/` yolları revalidate edilir.
- **`updateProject(id: string, input: ProjectInput)`**: Var olan bir projeyi günceller. En önemli özelliği **Log mekanizmasıdır**. Güncellenen değer ile eski değerleri karşılaştırıp, sadece değişen alanlar için `ProjectLog` tablosuna çoklu (createMany) kayıt atar. Bu işlem `$transaction` kullanılarak güvenli hale getirilmiştir.
- **`upsertAssignment(input)`**: Bir takım üyesinin (`teamMember`), bir projeye belirli bir yıl ve ay için ne kadar süre (plannedDays, actualDays) atandığını kaydeder. Kayıt varsa günceller, yoksa yaratır (`upsert`).
- **`deleteAssignment(id: string, projectId: string)`**: İlgili efor atamasını siler.

### `src/app/actions/licenses.ts`
- **`createLicense(input)`**: Sisteme yeni bir uygulama lisansı kaydeder. Yenileme tarihi varsa Date formatına dönüştürülür.
- **`updateLicense(id, input)`**: Lisans bilgilerini günceller.
- **`deleteLicense(id)`**: Lisans kaydını siler.
- **`createApplication(input)`**: Lisanslanacak yazılımın/uygulamanın kendisini (örn: Ignition, AutoCAD) sisteme kaydeder.

### `src/app/actions/admin.ts`
Bu dosyadaki tüm işlemler sadece **ADMIN** yetkisine sahip kullanıcılar tarafından çalıştırılabilir. `requireAdmin()` fonksiyonu ile yetki kontrolü sağlanır.
- **`requireAdmin()`**: Oturumu kontrol eder, `role !== "ADMIN"` ise hata fırlatır.
- **`createUser(input)`**: `bcryptjs` ile şifreyi hashlleyerek yeni bir kullanıcı yaratır. E-posta sistemde zaten varsa hata döner.
- **`updateUser(id, input)`**: Kullanıcıyı günceller. Eğer kullanıcı kendi yetkisini "USER" olarak düşürmeye çalışıyorsa buna engel olur. (Kendini adminlikten çıkaramaz).
- **`deleteUser(id)`**: Kullanıcı siler. Kendi hesabını silmeye çalışırsa engeller.
- **`upsertFactory(input)`**: Yeni bir fabrika yaratır veya mevcut bir fabrikayı günceller.
- **`deleteFactory(id)`**: Fabrikayı siler. Eğer fabrikaya bağlı bir proje varsa ORM hata fırlatır ve catch bloğu ile anlamlı bir kullanıcı hatası döndürülür.
- **`upsertMember(input)`**: Yeni takım üyesi yaratır veya mevcut üyeyi günceller.
- **`deleteMember(id)`**: Takım üyesini siler. Eğer atamaları (assignment) varsa hata döner.
- **`upsertApplication(input)`**: Yeni bir yazılım yaratır veya günceller.
- **`deleteApplication(id)`**: Yazılımı siler. Bağlı lisansı varsa hata döner.

### `src/app/actions/finance.ts`
- **`upsertMonthlyFinancial(input)`**: Aylık finansal durumu günceller. Burada kritik bir iş kuralı vardır: **Gelir (income) her zaman gönderilen giderin (expense) 1.05 katı (%5 kârlı hali) olarak hesaplanır** ve veritabanına öyle yazılır.
- **`addBudgetItem(input)`**: Projeye detaylı bütçe kalemi ekler. Toplam tutarı (amount) `quantity * unitPrice` şeklinde hesaplayarak kaydeder.
- **`deleteBudgetItem(id, projectId)`**: Bir bütçe kalemini siler.
- **`addInvoice(input)`**: Proje için fatura kaydı oluşturur. Tarih dönüşümü yapar.
- **`updateInvoiceStatus(id, status)`**: Faturanın durumunu (Ödendi, Bekliyor vb.) günceller.
- **`deleteInvoice(id)`**: Faturayı siler.

---

## 3. Yardımcı (Utility) ve Lib Fonksiyonları

### `src/lib/rates.ts` (Döviz Kuru Çekimi)
- **`parseForexSelling(xml: string, code: string)`**: TCMB'den dönen XML verisini regex kullanarak okur. İstenilen döviz kodu için `ForexSelling` / `Unit` hesabı yaparak 1 birimin TL karşılığını döner.
- **`getRates()`**: `fetch` ile TCMB'nin XML dosyasını çeker. Next.js cache sistemi kullanılarak saatte bir (3600 saniye) güncellenmesi sağlanmıştır. Fetch başarısız olursa sisteme önceden tanımlanmış sabit `FALLBACK` kurlarını döndürerek uygulamanın çökmesini engeller.
- **`toTRY(amount, currency, rates)`**: Verilen tutarı, o anki kurla çarparak TL karşılığını döner.

### `src/lib/utils.ts`
- **`cn(...inputs)`**: Tailwind sınıflarını güvenli şekilde birleştirir (clsx ve tailwind-merge kullanarak).
- **`formatMoney(value, currency)`**: Rakamları ilgili döviz cinsi sembolüyle Türkçe lokalinde formatlayıp string olarak döner.
- **`formatDate(d)`**: Tarih objesini orta boy (medium) Türkçe tarih formatına (Örn: 24 Kas 2024) dönüştürür.

### `src/lib/session.ts` & `src/lib/auth.ts`
- **`signSession(payload)`**: `jose` kütüphanesi kullanarak HS256 algoritmasıyla bir JWT token imzalar. Token süresi 7 gündür.
- **`verifySession(token)`**: JWT token'ı doğrular ve payload'ı döner. Hatalıysa null döner.
- **`getSession()`**: Sunucu bileşenlerinde (`cookies()` kullanarak) `bgr_session` çerezini okur ve `verifySession` ile doğrulayarak aktif oturumu döndürür.

### `src/lib/db.ts`
- **`prisma` instance**: Prisma client'ın uygulamanın geliştirme modunda sürekli baştan yaratılarak "Too many connections" hatasına yol açmasını engellemek amacıyla, `globalForPrisma` üzerinden tekilleştirilmesi sağlanır (Singleton pattern).

---

## 4. API Rotaları (Authentication)

### `src/app/api/auth/login/route.ts`
- **`POST()`**: E-posta ve şifre alır. `bcrypt.compare` ile şifreyi doğrular. Eğer giriş başarılı olursa `signSession()` ile JWT token üretir. Token'ı `bgr_session` isminde, `HttpOnly`, `SameSite=Lax` güvenlik kurallarıyla 7 günlük çerez olarak tarayıcıya yazar ve kullanıcı verilerini döner.

### `src/app/api/auth/logout/route.ts`
- **`POST()`**: `bgr_session` isimli çerezin `maxAge` süresini 0'a çekerek tarayıcıdan silinmesini sağlar, böylece oturum kapatılır.

---

## 5. UI ve İstemci (Client) Bileşenleri (Genel Yapı)
Geriye kalan klasörlerdeki (`src/app/` içerisindeki `page.tsx` ve `*-client.tsx` dosyaları ile `src/components/ui/`) tüm dosyalar standart React Fonksiyonel Bileşenleri (Functional Components) olarak görev yapmaktadır. 
- Sunucu Bileşenleri (`page.tsx`), veritabanı sorgularını yapıp (örn. `prisma.project.findMany()`) bu verileri İstemci Bileşenlerine (`-client.tsx`) prop olarak geçmektedir.
- Shadcn UI kullanılarak `Card`, `Button`, `Dialog`, `Input`, `Select`, `Table` gibi temel arayüz bileşenleri oluşturulmuştur.

Tüm bu sistem React'in modern App Router yapısında, asenkron Server Actions mantığıyla, REST API'lara ihtiyaç duymadan doğrudan Frontend - DB iletişimiyle hızlı ve güvenli bir şekilde çalışmaktadır.

---

## 6. Toplu Veri Yükleme (Initial Load) — Bulk Import

### `src/app/actions/bulk-import.ts`
Admin panelinden Excel (.xlsx) dosyası yükleyerek toplu veri girişi yapılmasını sağlayan server action'lar. Tüm fonksiyonlar `requireAdmin()` ile korunur.

- **`bulkImportFactories(rows)`**: Fabrikaları toplu ekler. Aynı isimde varsa atlar.
- **`bulkImportMembers(rows)`**: Ekip üyelerini toplu ekler. "Aktif" sütunu Evet/Hayır olarak okunur.
- **`bulkImportApplications(rows)`**: Uygulamaları toplu ekler. Aynı isimde varsa atlar.
- **`bulkImportProjects(rows)`**: Projeleri toplu ekler. Fabrika ismi ile ID eşleştirilir. Risk/Öncelik/Durum enum değerleri doğrulanır.
- **`bulkImportBudgetItems(rows)`**: Bütçe kalemlerini toplu ekler. Proje ismi ile ID eşleştirilir. amount = quantity × unitPrice olarak hesaplanır.
- **`bulkImportFinancials(rows)`**: Aylık finansal verileri toplu ekler. Gelir otomatik hesaplanır (giderin %5 fazlası). Aynı proje/yıl/ay varsa günceller (upsert).
- **`bulkImportLicenses(rows)`**: Lisansları toplu ekler. Uygulama ve fabrika isimleri ile ID eşleştirilir.

Her fonksiyon `BulkResult` döner: `{ ok, inserted, skipped, errors: [{ row, message }] }`

### `src/lib/excel-helpers.ts`
Client-side Excel işlemleri. SheetJS (xlsx) kütüphanesi kullanılır.

- **`downloadTemplate(type)`**: Seçilen veri tipi için formatlı .xlsx şablonu oluşturup indirir. Başlık satırı + 1-2 örnek satır içerir.
- **`parseExcelFile(file)`**: Yüklenen Excel dosyasını okuyup `{ headers, rows }` formatında JSON döner. Not satırları (⚠️ ile başlayan) otomatik atlanır.
- **`getTemplateHeaders(type)`**: İlgili veri tipinin beklenen sütun başlıklarını döner (doğrulama için).

### Admin UI — "Toplu Yükleme" Sekmesi
Admin panelinde 5. sekme olarak yer alır. Kullanıcı akışı:
1. Veri tipi seç (dropdown)
2. "Şablon İndir" ile hazır .xlsx indir
3. Dosyayı sürükle-bırak veya seç
4. İlk 5 satır ön izlemede gösterilir
5. "Yükle" butonu ile server action tetiklenir
6. Sonuç raporu: eklenen/atlanan/hatalı satır sayıları ve hata detayları
