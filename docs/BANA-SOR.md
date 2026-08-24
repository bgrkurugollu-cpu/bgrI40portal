# "Bana Sor" — Lokal AI Veritabanı Asistanı

Portal verisiyle ilgili soruları, **veriyi hiç dışarı çıkarmadan**, makinede
çalışan bir Ollama modeliyle yanıtlar. Hiçbir bulut LLM servisi kullanılmaz.

## Nasıl çalışır

Model veritabanı üzerinde *eğitilmez* — eğitim (fine-tuning) her veri
değişikliğinde saatler sürer ve değişen veriyi yakalayamaz. Bunun yerine
**RAG (Retrieval-Augmented Generation)** kullanılır: veritabanı her soruda
taranır, soruyla ilgili kayıtlar seçilir ve modele bağlam olarak verilir.
Sonuç, eğitimin aksine **anlık günceldir**.

```
Soru
 │
 ├─▶ 1. Tazelik kontrolü      pg_stat_user_tables yazma sayaçları okunur.
 │      (fingerprint.ts)      Veri değişmişse bilgi tabanı yeniden kurulur.
 │
 ├─▶ 2. Bilgi tabanı          Prisma şeması (DMMF) okunarak her tablo ve alan
 │      (knowledge.ts)        otomatik metne çevrilir; kayıt parçaları +
 │                            hesaplanmış toplam/özet parçaları üretilir.
 │
 ├─▶ 3. Seçim                 Sözcük eşleşmesi (idf) + anlamsal benzerlik
 │      (retrieve.ts)         (embedding) birleştirilerek en ilgili parçalar
 │                            context penceresine sığacak kadar seçilir.
 │
 └─▶ 4. Yanıt                 Ollama'daki lokal model akışlı (streaming) yanıtlar.
        (ollama.ts)
```

### Kendi kendini güncelleme

Tazelik sinyali PostgreSQL'in kendi yazma sayaçlarıdır (`n_tup_ins + n_tup_upd
+ n_tup_del`). Bu tercihin üç sonucu var:

- **Her yazma yakalanır.** Tabloda `updatedAt` sütunu olması gerekmez.
- **Uygulama dışı değişiklikler de yakalanır** — seed, Excel toplu içe aktarma,
  elle çalıştırılan SQL.
- **Yeni tablolar kendiliğinden kapsanır.** Şemaya tablo eklendiğinde sayaç
  listesine de kendiliğinden girer.

Kontrol tek bir hafif sorgudur ve en fazla `AI_FRESHNESS_CHECK_MS` (varsayılan
3 sn) sıklığında çalışır. İmza değişmemişse hazır indeks kullanılır.

### Şema değişikliklerine uyum

Bilgi tabanı elle yazılmış bir tablo listesinden değil, **Prisma DMMF'inden**
üretilir (`introspect.ts`). Şemaya yeni bir model veya alan eklendiğinde:

- alan otomatik olarak kayıt metnine girer,
- sayısal alansa toplamları otomatik hesaplanır,
- enum alansa dağılımı otomatik çıkarılır,
- modele anlatılan şema tarifi otomatik güncellenir.

Türkçe etiket sözlüğü (`introspect.ts` içindeki `FIELD_LABELS`) yalnızca
okunabilirlik içindir; karşılığı olmayan alan adı olduğu gibi kullanılır.

### Gizlilik

`passwordHash`, `licenseKey`, `secret`, `token`, `apiKey` gibi alanlar
`REDACTED_FIELD_PATTERN` ile bilgi tabanına **hiç alınmaz**; modele gönderilmez.

## API uçları

Tümü oturum çerezi gerektirir (`middleware.ts` koruması altında).

| Uç | Yöntem | Açıklama |
|---|---|---|
| `/api/chat` | POST | Soru sorar. `{ messages, stream? }` |
| `/api/chat/health` | GET | Ollama erişimi, seçilen model, indeks durumu, sorunlar |
| `/api/chat/models` | GET | Kurulu modeller, boyutları, hangisinin aktif olduğu |
| `/api/chat/index` | GET | Bilgi tabanının durumu (`?refresh=1` tazelik kontrolü yapar) |
| `/api/chat/index` | POST | Bilgi tabanını koşulsuz yeniden kurar |

### `POST /api/chat`

```jsonc
// İstek
{
  "messages": [{ "role": "user", "content": "Aktif projelerin toplam bütçesi ne kadar?" }],
  "stream": true   // NDJSON akış; false ise tek JSON
}
```

`stream: true` yanıtı satır başına bir JSON nesnesidir:

```jsonc
{"meta": { "model": "...", "retrieval": {...}, "index": {...} }, "done": false}
{"message": {"role": "assistant", "content": "Aktif"}, "done": false}
{"message": {"role": "assistant", "content": " projelerin"}, "done": false}
{"done": true}
```

`meta` alanı teşhis içindir: hangi model kullanıldı, kaç bilgi parçası
gönderildi, indeks ne zaman kuruldu, uyarı var mı.

## Ayarlar

Tümü ortam değişkenidir; model değiştirmek için **kod düzenlemek gerekmez**.

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `OLLAMA_URL` | `http://llm:11434` | Ollama adresi |
| `OLLAMA_MODEL` | `gemma4:e4b` | Sohbet modeli |
| `OLLAMA_EMBED_MODEL` | `none` | Gömme modeli. Varsayılan **kapalı** — bkz. Bellek |
| `OLLAMA_NUM_CTX` | `8192` | Context penceresi (token). Doğrudan bellek tüketir |
| `OLLAMA_HOST_PORT` | `11435` | Ollama'nın host'a yayınlandığı port |
| `OLLAMA_TEMPERATURE` | `0.15` | Düşük = daha tutarlı, uydurmaya daha az eğilimli |
| `OLLAMA_TIMEOUT_MS` | `600000` | İstek zaman aşımı |
| `AI_CONTEXT_BUDGET_CHARS` | otomatik | Bağlama konacak en fazla karakter |
| `AI_CONTEXT_BUDGET_MAX_CHARS` | `14000` | Yukarıdakinin tavanı. Yanıt süresini belirleyen asıl ayar |
| `AI_RETRIEVAL_TOP_K` | `60` | Değerlendirilecek aday parça sayısı |
| `AI_FRESHNESS_CHECK_MS` | `3000` | Tazelik kontrolünün en sık aralığı |

### Dayanıklılık

Yapılandırma hatalı ya da model eksik olsa bile asistan tamamen susmaz:

- **Model kurulu değilse** aynı aileden veya kurulu en küçük sohbet modeline düşer.
- **Model belleğe sığmazsa** (`signal: killed`) kurulu en küçük modelle yeniden dener.
- **Gömme modeli yoksa** anlamsal arama kapanır, sözcük tabanlı arama devam eder.

Her durumda arayüzde sarı uyarı şeridi çıkar ve `meta` alanında sebep bildirilir.

## Bellek ve hız

Konteynerin bellek ihtiyacı yalnızca model dosyasının boyutu değildir:

```
gereken bellek  =  model ağırlıkları
                +  KV cache          (num_ctx ile orantılı, birkaç GB olabilir)
                +  aynı anda yüklü diğer modeller (ör. gömme modeli)
```

Sınır aşılınca `llama-server` sessizce (SIGKILL) öldürülür. Belirtisi ya
yükleme sırasında `signal: killed`, ya da üretim ortasında **`unexpected EOF`**
olur — logda gerekçe görünmez.

Bu makinede (16 GB RAM, Docker'a 11.67 GB ayrılmış) ölçülenler:

| Yapılandırma | Sonuç |
|---|---|
| `gemma4:26b` (16.75 GB) | ✗ yüklenemedi |
| `gemma4:e4b` + `num_ctx=32768` + gömme modeli açık | ✗ üretim ortasında `unexpected EOF` |
| `gemma4:e4b` + `num_ctx=8192` + gömme kapalı | ✓ çalışıyor |

Varsayılanlar bu yüzden `num_ctx=8192` ve `OLLAMA_EMBED_MODEL=none` seçilmiştir.

### Hız

Docker Desktop macOS'ta GPU'ya erişemez; modeller CPU'da çalışır. Ölçülen
prompt işleme hızı **~50 token/sn**. Yanıt süresini belirleyen şey budur:

| Bağlam | Yalnızca prompt işleme |
|---|---|
| 14.000 karakter (~4.000 token) | ~80 sn |
| 60.000 karakter (~17.000 token) | ~5,5 dk |

`AI_CONTEXT_BUDGET_MAX_CHARS` bu yüzden 14.000'de tutulur: sabitlenmiş özet
blokları (şema + genel toplamlar + sıralamalar) her zaman gönderildiği için
sayım/toplam/sıralama soruları bu bütçeyle de tam doğru yanıtlanır; bütçe
yalnızca kaç ek **kayıt satırının** sığacağını belirler.

**Belirgin hız için Ollama'yı hostta çalıştırın** (Metal GPU erişimi olur):
`llm` servisini kaldırıp `OLLAMA_URL=http://host.docker.internal:11434`
yapmak yeterlidir. O kurulumda `num_ctx` ve gömme modeli rahatça açılabilir.

> **Port notu:** macOS'ta Ollama.app kuruluysa 11434'ü kendisi kapar ve
> konteyner `address already in use` ile başlayamaz. Bu yüzden Docker'daki
> Ollama host'a **11435**'ten yayınlanır (`OLLAMA_HOST_PORT` ile değişir).
> Uygulama zaten Docker ağından `http://llm:11434` adresine bağlanır.

## Sorun giderme

Önce daima `/api/chat/health`:

```bash
curl -s -b "bgr_session=<oturum-çerezi>" http://localhost:3000/api/chat/health | jq
```

| Belirti | Sebep | Çözüm |
|---|---|---|
| `reachable: false` | Ollama kapalı ya da `OLLAMA_URL` yanlış | `docker compose up -d llm` |
| `signal: killed` | Model yüklenirken belleğe sığmadı | Docker belleğini artır ya da küçük model seç |
| `unexpected EOF` | Model üretim ortasında öldürüldü | `OLLAMA_NUM_CTX`'i düşür, `OLLAMA_EMBED_MODEL=none` yap |
| `address already in use` (11434) | Ollama.app portu kapmış | `OLLAMA_HOST_PORT` değiştir ya da Ollama.app'i kapat |
| `fallback: true` | Yapılandırılan model kurulu değil | `ollama pull <model>` |
| Anlamsal arama kapalı | Gömme modeli yok | `ollama pull embeddinggemma` |
| Yanıtlar eski veriyi gösteriyor | — | `POST /api/chat/index` ile zorla tazele |
