# Değişiklik Günlüğü

Her commit ve push burada kayıtlıdır. **En yeni en üstte.**

Yeni kayıt eklemek için: `./yeni-kayit.sh "kisa-baslik"` (bkz.
[`../04-CALISMA-AKISI.md`](../04-CALISMA-AKISI.md) §7)

## Vercel dönemi (2026-08-30 →)

| Tarih | Commit | Özet | Şema | Detay |
|---|---|---|---|---|
| 2026-09-04 | `9715f0c` | Lead detay sayfasında Hedef Bütçe kartı yerine Ciro (tüm gelirlerin toplamı) kartı gösteriliyor | — | [↗](2026-09-04-lead-detay-ciro-karti.md) |
| 2026-09-04 | `763605c` | Otomatik gelir formülü düzeltildi: gider + giderin %5'i (önceden yalnızca %5 yazılıyordu) | — | [↗](2026-09-04-otomatik-gelir-formul-duzeltme.md) |
| 2026-09-04 | `11551e7` | PT Kodları modülü tamamen kaldırıldı (üretimde veri yoktu); Bütçe & Finans'taki Ciro Dağılımı'nda PT kırılımı yerine Proje/Lead-CR kırılımı gösteriliyor; Ana Sayfa'ya Toplam Hedef Bütçe'nin yanına Ciro info kartı eklendi (Bütçe & Finans'takiyle aynı hesap) | ✅ | [↗](2026-09-04-pt-kodlari-kaldirma-lead-cr-akisi-ciro-anasayfa.md) |
| 2026-09-04 | `f617a85` | Lead/CR ekranında yeni kayıt için CR türü ve Proje seçeneği kaldırıldı (yalnızca Lead açılabiliyor); Lead kayıtlarında Proje Kodu artık zorunlu değil (boş bırakılırsa otomatik kod atanır), Projeler tarafında zorunluluk aynı kalıyor | — | [↗](2026-09-04-lead-cr-cr-kaldirma-proje-kodu-opsiyonel.md) |
| 2026-09-04 | `0f57121` | Fatura Ekle formuna 'Otomatik %5 Gelir Ekle' butonu eklendi (Gider seçiliyken): giderin %5'i tutarında, aynı tarihli, EBA No'su sabit '1' olan bir gelir faturasını otomatik oluşturur | — | [↗](2026-09-04-otomatik-yuzde5-gelir-faturasi.md) |
| 2026-09-03 | `8ca6785` | Projeler sayfasına PRJ/DEMAND/AUTO kod filtreleri, Lead/CR sayfasına Lead/CR tür filtreleri eklendi (arama kutusunun sağında hızlı seçim kutuları) | — | [↗](2026-09-03-prj-demand-auto-lead-cr-filtreleri.md) |
| 2026-09-03 | `9bafa01` | Kalıcı proje dokümantasyonu ve değişiklik günlüğü kuruldu: docs/ altında onboarding, mimari, deployment, veri modeli, çalışma akışı ve modül referansı; tüm commit geçmişi degisiklikler/ altında kayıt altına alındı | — | [↗](2026-09-03-proje-dokumantasyon-sistemi.md) |
| 2026-09-03 | `9740e48` | Aylık Finans'a admin-only "Düzenle" modu (tüm ayları toplu revize) | — | [↗](2026-09-03-aylik-finans-admin-duzenleme.md) |
| 2026-09-03 | `f6d7dbc` | İptal statüsündeki satırlar açık kırmızı arkaplanla vurgulandı | — | — |
| 2026-09-03 | `eb9e5e7` | Ödeme Planı metin alanı kaldırıldı; Bütçe Kırılımı'na admin-only Düzenle; Proje Cirosu kartı kaldırıldı; Karlılık <%5 kırmızı yanıp sönme | ✅ | [↗](2026-09-03-butce-duzenleme-karlilik-uyarisi.md) |
| 2026-09-03 | `01f68e0` | Ödeme Planı milestone bazlı yapıya geçti + "Kesilmesi Gereken Gelir" kartı | ✅ | [↗](2026-09-03-odeme-plani-milestone.md) |
| 2026-09-03 | `336408b` | Fatura tipine İç Kaynak Geliri; Karlılık formülü düzeltildi (gider×%5 kaldırıldı) | ✅ | [↗](2026-09-03-ic-kaynak-faturasi-karlilik-formulu.md) |
| 2026-09-03 | `cdbd9f8` | 6'lı revizyon: bütçe admin-only, fatura Gider/Gelir tipi + otomatik aylık finans, ay-sütun tablo, Ana/Alt Görev, Ödeme Planı sadeleştirme, Karlılık KPI | ✅ | [↗](2026-09-03-finans-revizyon-paketi.md) |
| 2026-08-31 | `e8cbec6` | **Yeni Lead / CR modülü** (Projeler altyapısını paylaşır, risk/öncelik yok) | ✅ | [↗](2026-08-31-lead-cr-modulu.md) |
| 2026-08-31 | `2c839b4` | Excel butonu "Dışa Aktar"; milestone çubuğu süre boyunca uzatıldı; Ana/Alt görev hiyerarşisi zorunlu | — | [↗](2026-08-31-gantt-iyilestirmeleri.md) |
| 2026-08-31 | `dfa9d56` | Kaynak Planı doluluk kolonu, proje JIRA linki, Proje Planı Excel export, görev JIRA kodu | ✅ | [↗](2026-08-31-doluluk-jira-excel.md) |
| 2026-08-30 | `746bbd2` | CAPEX alt kalemine proje arama/seçme + TCMB kuruyla Hedef Bütçe senkronu | ✅ | [↗](2026-08-30-capex-proje-baglantisi.md) |
| 2026-08-30 | `9a977cb` | CLAUDE.md: ayrı `I40DB` kurulumu belgelendi | — | — |
| 2026-08-30 | `c348df9` | **Vercel deploy hazırlığı**: lockfile platform kilidi, postinstall prisma generate, allowedOrigins | — | [↗](2026-08-30-vercel-kurulumu-ve-db-ayristirma.md) |
| 2026-08-30 | `a4d1f02` | Güvenlik: hardcoded DB/admin şifreleri env tabanlı hale getirildi | — | — |
| 2026-08-30 | `c7ca462` | Vercel production + şema senkron kuralı CLAUDE.md'ye eklendi | — | — |
| 2026-08-30 | `836f02d` | Server Actions `allowedOrigins`'e `*.vercel.app` eklendi | — | — |

### Kayıt altına alınan altyapı işlemleri (commit'siz)

| Tarih | İşlem |
|---|---|
| 2026-09-03 | Mevcut 34 faturadan `MonthlyFinancial` geriye dönük yeniden hesaplandı (tek seferlik script, sonra silindi) |
| 2026-08-30 | **DB ayrıştırma**: `bgrbrain` şeması (25 tablo) `scoringv2`'nin paylaşımlı Neon instance'ından yeni `I40DB`'ye taşındı; satır sayıları birebir doğrulandı |
| 2026-08-30 | `.env.vercel-production` bu makinede oluşturuldu (gitignore'da) |

## Vercel öncesi (özet)

Uygulamanın çekirdeği bu dönemde kuruldu. Öne çıkanlar:

| Tarih | Commit | Özet |
|---|---|---|
| 2026-08-26 | `8a47ed5` | Tamamlanan projeler yeşil arkaplan + varsayılan sıralama |
| 2026-08-26 | `ff5bf3b` | Kullanıcı bazlı sayfa erişim/düzenleme yetki sistemi |
| 2026-08-26 | `04d2591` | Dijital CAPEX Bütçesi modülü |
| 2026-08-26 | `44720c7` | PT verileri Finans + Dashboard toplamlarına dahil edildi |
| 2026-08-26 | `f87c4c4` | **Proje Planı (Gantt) modülü**; Ekip & Efor kişi×ay matrisi |
| 2026-08-26 | `67f5576` | **PT Kodları modülü** + Pipeline Kodu (PTM) alanı |
| 2026-08-25 | `bb97d41` | Ödeme Planı v1 (`PaymentPlanItem` — sonradan milestone yapısına devredildi) |
| 2026-08-25 | `85bab37` | Fatura eBA No zorunlu, kur farkı eBA No alanı |
| 2026-08-25 | `e04baee` | Kaynak Planı sadeleştirildi, açılır proje paneli, admin kilidi |
| 2026-08-25 | `c8da1ea` | Genişleyebilir sidebar |
| 2026-08-24 | `ea74bdd` | Bütçe kalemlerine CAPEX/OPEX tipi + para birimi bazlı toplamlar |
| 2026-08-24 | `e5a6f8b` | Bütçe kırılımına Excel içe/dışa aktarma |
| 2026-08-24 | `57d17f2`, `bb391ea` | "Bana Sor" AI sohbeti ve Ollama/RAG altyapısı tamamen kaldırıldı |

> Tam liste için: `git log --oneline`
