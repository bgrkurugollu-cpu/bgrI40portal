# "Bana Sor" — Lokal AI Veritabanı Asistanı

Portal verisiyle ilgili soruları, **veriyi hiç dışarı çıkarmadan**, makinede
çalışan bir Ollama modeliyle yanıtlar. Hiçbir bulut LLM servisi kullanılmaz.

## Kurulum

Ollama **hostta** çalışır, Docker konteynerinde değil. Sebebi ölçülmüştür:
Docker Desktop macOS'ta GPU'ya erişemez ve aynı model CPU'da kat kat yavaştır.

```bash
# 1. Ollama hostta çalışıyor olmalı (Ollama.app açık ya da `ollama serve`)
curl -s http://localhost:11434/api/version

# 2. Modelleri çek
ollama pull gemma4:e4b        # sohbet modeli  (~9.6 GB)
ollama pull embeddinggemma    # anlamsal arama (~0.6 GB)

# 3. Uygulamayı başlat
docker compose up -d

# 4. Doğrula
curl -s -b "bgr_session=<oturum-çerezi>" http://localhost:3000/api/chat/health
```

Konteyner, host'taki Ollama'ya `host.docker.internal:11434` üzerinden bağlanır.

> **Ollama.app kapalıysa asistan çalışmaz.** `/api/chat/health` bu durumu
> açıkça bildirir. Ollama.app'i "oturum açıldığında başlat" olarak
> ayarlamanız önerilir.

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
| `OLLAMA_URL` | `http://host.docker.internal:11434` | Hosttaki Ollama'nın adresi |
| `OLLAMA_MODEL` | `gemma4:e4b` | Sohbet modeli |
| `OLLAMA_EMBED_MODEL` | `embeddinggemma` | Gömme modeli (`none` → anlamsal arama kapalı) |
| `OLLAMA_NUM_CTX` | `16384` | Context penceresi (token). Kapsam/hız dengesini belirler |
| `OLLAMA_TEMPERATURE` | `0.15` | Düşük = daha tutarlı, uydurmaya daha az eğilimli |
| `OLLAMA_TIMEOUT_MS` | `600000` | İstek zaman aşımı |
| `AI_CONTEXT_BUDGET_CHARS` | otomatik | Bağlama konacak en fazla karakter |
| `AI_CONTEXT_BUDGET_MAX_CHARS` | `24000` | Yukarıdakinin tavanı |
| `AI_RETRIEVAL_TOP_K` | `60` | Değerlendirilecek aday parça sayısı |
| `AI_FRESHNESS_CHECK_MS` | `3000` | Tazelik kontrolünün en sık aralığı |

### Dayanıklılık

Yapılandırma hatalı ya da model eksik olsa bile asistan tamamen susmaz:

- **Model kurulu değilse** aynı aileden veya kurulu en küçük sohbet modeline düşer.
- **Model belleğe sığmazsa** (`signal: killed`) kurulu en küçük modelle yeniden dener.
- **Gömme modeli yoksa** anlamsal arama kapanır, sözcük tabanlı arama devam eder.

Her durumda arayüzde sarı uyarı şeridi çıkar ve `meta` alanında sebep bildirilir.

## Bellek ve hız

Bellek ihtiyacı yalnızca model dosyasının boyutu değildir:

```
gereken bellek  =  model ağırlıkları
                +  KV cache          (num_ctx ile orantılı)
                +  aynı anda yüklü diğer modeller (ör. gömme modeli)
```

Sınır aşılınca `llama-server` sessizce (SIGKILL) öldürülür. Belirtisi ya
yükleme sırasında `signal: killed`, ya da üretim ortasında **`unexpected EOF`**
olur — logda gerekçe görünmez.

Bu makinede (16 GB RAM, M4) ölçülenler:

| Yapılandırma | Bellek | Sonuç |
|---|---|---|
| `gemma4:26b` (16.75 GB) | — | ✗ hiçbir kurulumda yüklenemedi |
| Docker (CPU), `num_ctx=32768`, gömme açık | > 11.67 GB | ✗ üretim ortasında `unexpected EOF` |
| Docker (CPU), `num_ctx=8192`, gömme kapalı | 10.18 GB | ✓ çalışır, ama yavaş |
| **Host (GPU), `num_ctx=16384`, gömme açık** | **3.9 GB** | ✓ **kullanılan kurulum** |

Hostta belleğin bu kadar düşük olması şaşırtıcı değil: `gemma4:e4b` diskte
9.6 GB olsa da "effective 4B" mimarisiyle GPU'ya yalnızca aktif katmanlar
yüklenir (3.2 GB) — gömme modeliyle birlikte toplam 3.9 GB. Yani Docker'daki
bellek darboğazı host kurulumunda tamamen ortadan kalkar.

> **Docker Desktop belleği:** Ollama artık konteynerde çalışmadığı için
> Docker'ın büyük bir bellek payına ihtiyacı kalmadı. Settings → Resources →
> Memory değerini **4 GB civarına indirin**; aksi hâlde Docker'ın ayırdığı pay
> host'taki modele yer bırakmaz ve makine takas belleğine (swap) düşer.

### Hız

Ölçülen prompt işleme hızları:

| Kurulum | Prompt işleme | Üretim |
|---|---|---|
| Docker (CPU), 32K pencere + gömme açık | ~40 token/sn | — |
| Docker (CPU), 8K pencere + gömme kapalı | ~110 token/sn | — |
| **Host (Metal GPU)** | **~340 token/sn** | **~28 token/sn** |

Uçtan uca ölçülen yanıt süreleri (host, GPU, 16K pencere, ~18.000 karakter
bağlam): **40-47 saniye**. 8K pencerede (~9.000 karakter) bu süre 30 saniyeye
iner ama bağlama yarı yarıya daha az kayıt girer — `OLLAMA_NUM_CTX` ile
kapsam/hız dengesini kendiniz kurabilirsiniz.

Yanıt süresini belirleyen şey bağlamın büyüklüğüdür; bu yüzden
`AI_CONTEXT_BUDGET_MAX_CHARS` bir tavan uygular. Sabitlenmiş bloklar
(şema + genel toplamlar + durum kırılımları) her zaman gönderildiği için
sayım/toplam/kırılım soruları bu bütçeyle de tam doğru yanıtlanır; bütçe
yalnızca kaç ek **kayıt satırının** sığacağını belirler.

**Türkçe token oranı:** ölçüm, 14.000 karakterin 6.498 token ettiğini gösterdi
(token başına ~2.15 karakter). İngilizce için sık kullanılan ~4 karakter
varsayımı burada bağlamın pencereye sığdığını sanıp taşmasına yol açar; kod
2.0 kullanır.

## Sorun giderme

Önce daima `/api/chat/health`:

```bash
curl -s -b "bgr_session=<oturum-çerezi>" http://localhost:3000/api/chat/health | jq
```

| Belirti | Sebep | Çözüm |
|---|---|---|
| `reachable: false` | Hosttaki Ollama kapalı | Ollama.app'i başlatın (ya da `ollama serve`) |
| `signal: killed` | Model yüklenirken belleğe sığmadı | Docker belleğini artır ya da küçük model seç |
| `unexpected EOF` | Model üretim ortasında öldürüldü | `OLLAMA_NUM_CTX`'i düşür, `OLLAMA_EMBED_MODEL=none` yap |
| `fallback: true` | Yapılandırılan model kurulu değil | `ollama pull <model>` |
| Anlamsal arama kapalı | Gömme modeli yok | `ollama pull embeddinggemma` |
| Yanıtlar eski veriyi gösteriyor | — | `POST /api/chat/index` ile zorla tazele |
