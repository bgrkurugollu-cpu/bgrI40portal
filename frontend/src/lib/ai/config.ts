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
   * Gömme (embedding) modeli. Kuruluysa anlamsal arama devreye girer,
   * kurulu değilse sistem otomatik olarak sadece sözcük tabanlı aramaya düşer.
   */
  embedModel: str('OLLAMA_EMBED_MODEL', 'embeddinggemma'),

  /** Modelin context penceresi (token). */
  numCtx: num('OLLAMA_NUM_CTX', 32768),

  temperature: num('OLLAMA_TEMPERATURE', 0.15),
  topP: num('OLLAMA_TOP_P', 0.9),

  /** Tek bir isteğin en fazla bekleme süresi (ms). Büyük modeller yavaş yüklenir. */
  requestTimeoutMs: num('OLLAMA_TIMEOUT_MS', 600_000),

  /**
   * Veritabanı dökümünden prompt'a en fazla kaç karakter konacağı.
   * Varsayılan: context penceresinin ~%55'i (1 token ≈ 3.5 karakter),
   * geri kalanı sohbet geçmişi ve yanıt için ayrılır.
   */
  get contextBudgetChars(): number {
    const explicit = num('AI_CONTEXT_BUDGET_CHARS', 0);
    if (explicit > 0) return explicit;
    return Math.floor(this.numCtx * 3.5 * 0.55);
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
