# Proje, Bütçe ve Lisans Yönetimi Uygulaması - Faz 1 İsterleri

Bu doküman, geliştirilecek olan iç yönetim uygulamasının "Faz 1" kapsamındaki gereksinimlerini detaylandırmaktadır. Bu metin, uygulamanın mimarisini, veritabanı şemasını ve temel fonksiyonlarını oluşturmak için bir kılavuz niteliğindedir. Uygulama üç ana modülden oluşmaktadır.

## Modül 1: Proje ve Kaynak Yönetimi
Bu modül, fabrikalarda yürütülen projelerin tarihsel takibini ve 6 kişilik Endüstri 4.0 ekibinin kaynak planlamasını sağlamayı amaçlamaktadır.

### İstenen Özellikler:
*   **Proje Temel Kayıtları:** Her proje için isim, gerçekleşme ihtimali, ilgili fabrika, hedeflenen bütçe ve zaman çizelgesi girilebilmelidir. Tüm değişiklikler tarihsel bir log yapısıyla tutulmalıdır.
*   **Risk ve Önceliklendirme:** Projelere risk derecesi ve öncelik seviyesi atanabileceği alanlar bulunmalıdır.
*   **Ekip Kaynak Planlaması:** 
    *   Ekip üyelerinin projelere atanabileceği ilişkisel bir yapı kurulmalıdır.
    *   Atanan her kişi için aylık bazda harcanacak "adam-gün" eforu ve kullanılacak kaynaklar kaydedilebilmelidir.
    *   Genel (overall) görünümde, tüm projeler baz alınarak ekibe ait bütünsel bir kaynak planı/kapasite raporu sunulmalıdır.
*   **Hedef ve Gerçekleşen Karşılaştırması:** Planlanan adam-gün eforu ile fiili olarak gerçekleşen efor karşılaştırmalı olarak görülebilmelidir.

---

## Modül 2: Bütçe ve Finansal Yönetim
Projelerin finansal bacağının, gelir-gider dengesinin ve faturalama takviminin yönetildiği modüldür. Modül 1'deki projelerle tam entegre (linkli) çalışmalıdır.

### İstenen Özellikler:
*   **Kırılımlı Bütçe Kalemleri:** İlgili projeye tıklandığında, o projenin teklif ve bütçe kırılımları detaylı satırlar halinde görüntülenebilmelidir.
*   **Aylık Finansal Takip:** Yılın her ayı için bölünmüş bir girdi alanı (grid/tablo yapısı) olmalıdır. Her ay için, her projede asgari şu satırlar bulunmalıdır:
    *   Gelir
    *   Gider
    *   İç Kaynak Geliri
*   **Finansal Raporlama:** Hangi projenin faturasının ne zaman kesileceği, gelir ve gider akışının takvimi tek bir ekrandan raporlanabilmelidir.

---

## Modül 3: Lisans ve Key Yönetimi
Projelerde ve sistem altyapılarında kullanılan (örneğin Ignition gibi) uygulamaların lisans, anahtar ve abonelik takiplerinin yapıldığı modüldür.

### İstenen Özellikler:
*   **Uygulama ve Lisans Eşleştirmesi:** Kullanılan her bir uygulamanın lisans key'leri, detaylı açıklamaları ve hangi fabrikaya ait olduğu satır satır kaydedilebilmelidir.
*   **Maliyet ve Abonelik (Subscription) Takibi:** 
    *   Lisansların toplam yatırım bedeli girilebilmelidir.
    *   Sürekli ödenen (subscription/abonelik) lisans bedelleri, ödeme periyotları ve yenileme tarihleri takip edilebilmelidir.
*   **Lisans Envanteri:** Tüm lisansların hangi lokasyonda/fabrikada kullanıldığı, güncel maliyetleri ve durumları tek bir yönetim panelinden izlenebilmelidir.