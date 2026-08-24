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
| `OLLAMA_EMBED_MODEL` | `embeddinggemma` | Gömme modeli (`none` → anlamsal arama kapalı) |
| `OLLAMA_NUM_CTX` | `32768` | Context penceresi (token) |
| `OLLAMA_TEMPERATURE` | `0.15` | Düşük = daha tutarlı, uydurmaya daha az eğilimli |
| `OLLAMA_TIMEOUT_MS` | `600000` | İstek zaman aşımı |
| `AI_CONTEXT_BUDGET_CHARS` | otomatik | Bağlama konacak en fazla karakter (varsayılan: `numCtx × 3.5 × 0.55`) |
| `AI_RETRIEVAL_TOP_K` | `60` | Değerlendirilecek aday parça sayısı |
| `AI_FRESHNESS_CHECK_MS` | `3000` | Tazelik kontrolünün en sık aralığı |

### Dayanıklılık

Yapılandırma hatalı ya da model eksik olsa bile asistan tamamen susmaz:

- **Model kurulu değilse** aynı aileden veya kurulu en küçük sohbet modeline düşer.
- **Model belleğe sığmazsa** (`signal: killed`) kurulu en küçük modelle yeniden dener.
- **Gömme modeli yoksa** anlamsal arama kapanır, sözcük tabanlı arama devam eder.

Her durumda arayüzde sarı uyarı şeridi çıkar ve `meta` alanında sebep bildirilir.

## Bellek gereksinimi

Model ağırlıkları tamamen RAM'e yüklenir. Docker Desktop'a ayrılan bellek
model boyutundan küçükse konteyner `signal: killed` ile ölür.

| Model | Boyut | Gereken Docker belleği (~1.5×) |
|---|---|---|
| `gemma2:2b` | 1.5 GB | 4 GB |
| `gemma4:e4b` | 9.0 GB | 12 GB |
| `gemma4:26b` | 16.8 GB | 24 GB (16 GB RAM'li makinede çalışmaz) |

Ayar: **Docker Desktop → Settings → Resources → Memory** → Apply & Restart.

> Docker Desktop macOS'ta GPU'ya erişemez; modeller CPU'da çalışır. Belirgin
> hız artışı için Ollama'yı hostta çalıştırıp (Metal GPU) `docker-compose.yml`
> içindeki `llm` servisini kaldırın ve
> `OLLAMA_URL=http://host.docker.internal:11434` yapın.

## Sorun giderme

Önce daima `/api/chat/health`:

```bash
curl -s -b "bgr_session=<oturum-çerezi>" http://localhost:3000/api/chat/health | jq
```

| Belirti | Sebep | Çözüm |
|---|---|---|
| `reachable: false` | Ollama kapalı ya da `OLLAMA_URL` yanlış | `docker compose up -d llm` |
| `signal: killed` | Model belleğe sığmıyor | Docker belleğini artır ya da küçük model seç |
| `fallback: true` | Yapılandırılan model kurulu değil | `ollama pull <model>` |
| Anlamsal arama kapalı | Gömme modeli yok | `ollama pull embeddinggemma` |
| Yanıtlar eski veriyi gösteriyor | — | `POST /api/chat/index` ile zorla tazele |
