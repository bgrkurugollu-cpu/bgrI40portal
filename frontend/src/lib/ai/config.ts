/**
 * Lokal Ollama tabanlı "Bana Sor" asistanının tüm ayarları.
 *
 * Her değer ortam değişkeninden okunur; hiçbir model adı veya adres koda
 * gömülü değildir. Böylece model değiştirmek için kod değil sadece .env
 * güncellenir.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw && raw.trim() ? raw.trim() : fallback;
}

export const aiConfig = {
  /** Ollama sunucu adresi. Docker içinden `http://llm:11434`, hostta `http://localhost:11434`. */
  baseUrl: str('OLLAMA_URL', 'http://localhost:11434').replace(/\/+$/, ''),

  /** Sohbet modeli. Kurulu değilse otomatik olarak en yakın alternatife düşülür. */
  model: str('OLLAMA_MODEL', 'gemma4:e4b'),

  /**
   * Gömme (embedding) modeli — anlamsal arama için. `none` ise kapalıdır ve
   * sistem yalnızca sözcük tabanlı aramayla çalışır.
   *
   * Ollama hostta (Metal GPU ile) çalıştığı varsayılan kurulumda açıktır.
   * Ollama'yı GPU'suz bir konteynerde çalıştırıyorsanız kapatmayı düşünün:
   * gömme modeli sohbet modelinin YANINDA bellekte durur ve dar bir bellek
   * sınırında sohbet modelinin süreci sessizce öldürülür ("unexpected EOF").
   */
  embedModel: str('OLLAMA_EMBED_MODEL', 'embeddinggemma'),

  /**
   * Modelin context penceresi (token).
   *
   * Bu değer doğrudan bellek tüketir: Ollama, pencere boyutunda bir KV cache
   * ayırır ve bu, model ağırlıklarının ÜSTÜNE binen birkaç GB olabilir.
   * Gereğinden büyük seçmek, modelin belleğe sığmamasına yol açar.
   *
   * Varsayılan, `contextBudgetChars` ile gönderilen bağlamı + sohbet geçmişini
   * + yanıtı rahatça alacak şekilde seçilmiştir. Modelin desteklediği pencere
   * daha büyük olsa bile (ör. gemma4:e4b'de 131072) bu değer kullanılır.
   */
  numCtx: num('OLLAMA_NUM_CTX', 16384),

  temperature: num('OLLAMA_TEMPERATURE', 0.15),
  topP: num('OLLAMA_TOP_P', 0.9),

  /** Tek bir isteğin en fazla bekleme süresi (ms). Büyük modeller yavaş yüklenir. */
  requestTimeoutMs: num('OLLAMA_TIMEOUT_MS', 600_000),

  /**
   * Bilgi tabanından prompt'a en fazla kaç karakter konacağı.
   *
   * Bu değer doğrudan yanıt süresini belirler: model önce tüm prompt'u
   * işlemek zorundadır ve GPU'suz bir Docker konteynerinde bu ~40 token/sn
   * hızındadır. 60.000 karakterlik bir bağlam, tek kelime üretilmeden önce
   * ~4 dakika demektir.
   *
   * Bu yüzden varsayılan, modelin penceresi çok daha büyük olsa bile
   * `AI_CONTEXT_BUDGET_MAX_CHARS` ile sınırlanır. Sabitlenmiş özet blokları
   * (şema + genel toplamlar + sıralamalar) küçüktür ve her zaman gönderilir;
   * bütçe yalnızca kaç ek kaydın sığacağını belirler.
   *
   * GPU'lu bir kurulumda (Ollama hostta) bu tavan rahatlıkla yükseltilebilir.
   */
  get contextBudgetChars(): number {
    const explicit = num('AI_CONTEXT_BUDGET_CHARS', 0);
    if (explicit > 0) return explicit;
    // 2.0 karakter/token: Türkçe metnin ölçülen oranı (bkz. route.ts).
    const fromWindow = Math.floor(this.numCtx * 2.0 * 0.55);
    return Math.min(fromWindow, num('AI_CONTEXT_BUDGET_MAX_CHARS', 24_000));
  },

  /** Anlamsal aramada aday olarak değerlendirilecek kayıt sayısı. */
  retrievalTopK: num('AI_RETRIEVAL_TOP_K', 60),

  /**
   * Veri tazeliğinin en sık kaç ms'de bir kontrol edileceği.
   * Kontrol tek bir hafif sorgudur; içerik değişmişse indeks yeniden kurulur.
   */
  freshnessCheckMs: num('AI_FRESHNESS_CHECK_MS', 3_000),

  /** Model listesi önbelleğinin ömrü (ms). */
  modelCacheMs: num('AI_MODEL_CACHE_MS', 60_000),
};

export type AiConfig = typeof aiConfig;
