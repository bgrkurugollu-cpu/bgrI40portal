/**
 * Lokal Ollama sunucusuyla konuşan ince istemci.
 *
 * Tek sorumluluğu HTTP; iş mantığı yok. Model adı çözümlemesi burada yapılır
 * çünkü "kurulu olmayan model" hatası kullanıcıya en sık buradan yansır.
 */

import { aiConfig } from './config';

export interface OllamaModel {
  name: string;
  size: number;
  parameterSize?: string;
  quantization?: string;
  family?: string;
  capabilities?: string[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Node'un fetch'i (undici) yanıt başlıkları için 300 sn'lik sabit bir zaman
 * aşımı uygular. Yavaş bir makinede büyük bir modelin yüklenmesi + uzun bir
 * bağlamın işlenmesi bunu aşabilir ve istek `UND_ERR_HEADERS_TIMEOUT` ile
 * düşer. Aşağıdaki dispatcher bu sınırı YALNIZCA Ollama istekleri için
 * kaldırır; isteğin gerçek üst sınırı `OLLAMA_TIMEOUT_MS` ile AbortController
 * tarafından uygulanır.
 *
 * Node sürümü buna izin vermezse sessizce varsayılan davranışa dönülür.
 */
let dispatcher: unknown;
let dispatcherResolved = false;

function longTimeoutDispatcher(): unknown {
  if (dispatcherResolved) return dispatcher;
  dispatcherResolved = true;
  try {
    const current = (globalThis as any)[Symbol.for('undici.globalDispatcher.1')];
    const Agent = current?.constructor;
    if (typeof Agent === 'function') {
      dispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
    }
  } catch {
    dispatcher = undefined;
  }
  return dispatcher;
}

async function request(path: string, init?: RequestInit, timeoutMs = aiConfig.requestTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const agent = longTimeoutDispatcher();

  try {
    return await fetch(`${aiConfig.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      ...(agent ? { dispatcher: agent } : {}),
    } as RequestInit);
  } catch (error: any) {
    throw new Error(describeFetchFailure(error, path, timeoutMs));
  } finally {
    clearTimeout(timer);
  }
}

/** Ağ hatalarını, sebebi anlaşılır Türkçe mesaja çevirir. */
function describeFetchFailure(error: any, path: string, timeoutMs: number): string {
  const code = error?.cause?.code ?? error?.code;

  if (error?.name === 'AbortError') {
    return `Ollama ${Math.round(timeoutMs / 1000)} saniyede yanıt vermedi (${path}). Model çok büyük olabilir veya makine yükün altında kalmış olabilir.`;
  }
  if (code === 'UND_ERR_HEADERS_TIMEOUT' || code === 'UND_ERR_BODY_TIMEOUT') {
    return `Ollama yanıt başlıklarını zamanında gönderemedi (${path}). Model yüklenmesi çok uzun sürüyor olabilir.`;
  }
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `Ollama sunucusuna ulaşılamıyor: ${aiConfig.baseUrl} (${code}). Sunucunun çalıştığını ve OLLAMA_URL değerini kontrol edin.`;
  }
  if (code === 'ECONNRESET' || code === 'UND_ERR_SOCKET') {
    return `Ollama bağlantısı koptu (${code}). Model süreci bellek yetersizliğinden sonlandırılmış olabilir (signal: killed).`;
  }
  return `Ollama isteği başarısız (${path}): ${error?.message ?? error}`;
}

/** Ollama ayakta mı, hangi sürüm? */
export async function getVersion(): Promise<string | null> {
  try {
    const res = await request('/api/version', {}, 5_000);
    if (!res.ok) return null;
    return (await res.json()).version ?? null;
  } catch {
    return null;
  }
}

let modelCache: { at: number; models: OllamaModel[] } | null = null;

/** Kurulu modelleri listeler (kısa süreli önbellekli). */
export async function listModels(force = false): Promise<OllamaModel[]> {
  if (!force && modelCache && Date.now() - modelCache.at < aiConfig.modelCacheMs) {
    return modelCache.models;
  }
  const res = await request('/api/tags', {}, 10_000);
  if (!res.ok) throw new Error(`Ollama /api/tags hatası: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const models: OllamaModel[] = (data.models ?? []).map((m: any) => ({
    name: m.name,
    size: m.size,
    parameterSize: m.details?.parameter_size,
    quantization: m.details?.quantization_level,
    family: m.details?.family,
    capabilities: m.capabilities,
  }));
  modelCache = { at: Date.now(), models };
  return models;
}

/** Model listesi önbelleğini düşürür (yeni model çekildiğinde çağrılır). */
export function invalidateModelCache(): void {
  modelCache = null;
}

export interface ResolvedModel {
  /** Gerçekten kullanılacak model adı. */
  name: string;
  /** İstenen model adı. */
  requested: string;
  /** İstenen model kurulu değildi ve alternatife düşüldü mü? */
  fallback: boolean;
  /** Alternatife düşüldüyse sebebi. */
  note?: string;
}

/**
 * İstenen modeli kurulu modellere göre çözümler.
 *
 * Sıra: birebir eşleşme → aynı ad farklı etiket (gemma4:e4b ⇒ gemma4:26b) →
 * `completion` yeteneği olan en küçük model. Böylece model etiketi değişse veya
 * env yanlış yazılsa bile asistan tamamen susmaz, sadece uyarı üretir.
 */
export async function resolveChatModel(requested = aiConfig.model): Promise<ResolvedModel> {
  const models = await listModels();
  if (models.length === 0) {
    throw new Error('Ollama sunucusunda hiç model kurulu değil. Örn: `ollama pull gemma4:e4b`');
  }

  const names = models.map((m) => m.name);
  if (names.includes(requested)) return { name: requested, requested, fallback: false };

  // "gemma4" ⇒ "gemma4:e4b" gibi etiketsiz yazımlar
  const bare = requested.split(':')[0];
  const sameFamily = models.filter((m) => m.name.split(':')[0] === bare);
  if (sameFamily.length > 0) {
    const pick = sameFamily.sort((a, b) => a.size - b.size)[0];
    return {
      name: pick.name,
      requested,
      fallback: true,
      note: `"${requested}" kurulu değil; aynı aileden "${pick.name}" kullanılıyor.`,
    };
  }

  const chatCapable = models
    .filter((m) => !m.capabilities || m.capabilities.includes('completion'))
    .sort((a, b) => a.size - b.size);
  const pick = (chatCapable[0] ?? models[0]).name;
  return {
    name: pick,
    requested,
    fallback: true,
    note: `"${requested}" kurulu değil; kurulu modeller arasından "${pick}" kullanılıyor. Doğru model için: \`ollama pull ${requested}\``,
  };
}

/** Gömme modeli kurulu mu? Kurulu değilse anlamsal arama devre dışı kalır. */
export async function resolveEmbedModel(): Promise<string | null> {
  const requested = aiConfig.embedModel;
  if (!requested || requested.toLowerCase() === 'none') return null;
  try {
    const names = (await listModels()).map((m) => m.name);
    if (names.includes(requested)) return requested;
    const bare = requested.split(':')[0];
    const match = names.find((n) => n.split(':')[0] === bare);
    return match ?? null;
  } catch {
    return null;
  }
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  numCtx?: number;
  temperature?: number;
}

/** Akışsız sohbet: tamamlanmış yanıtı döndürür. */
export async function chat(opts: ChatOptions): Promise<{ content: string; raw: any }> {
  const res = await request('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildChatBody({ ...opts, stream: false })),
  });
  if (!res.ok) {
    throw new Error(`Ollama sohbet hatası (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return { content: data.message?.content ?? '', raw: data };
}

/**
 * Akışlı sohbeti başlatır.
 *
 * Bağlantı ve model yükleme hataları akış başlamadan önce, bu fonksiyondan
 * fırlatılır. Böylece çağıran taraf (ör. model belleğe sığmadıysa) başka bir
 * modelle yeniden deneyebilir.
 */
export async function openChatStream(opts: ChatOptions): Promise<AsyncGenerator<string>> {
  const res = await request('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildChatBody({ ...opts, stream: true })),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Ollama sohbet hatası (${res.status}): ${await res.text()}`);
  }
  return readNdjson(res.body);
}

/** Ollama satır başına bir JSON nesnesi (NDJSON) gönderir; metin parçalarını ayıklar. */
async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline: number;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        const piece = parsed.message?.content;
        if (piece) yield piece;
        if (parsed.done) return;
      } catch {
        // Yarım kalmış satır: bir sonraki parçada tamamlanır.
      }
    }
  }
}

function buildChatBody(opts: ChatOptions) {
  return {
    model: opts.model,
    messages: opts.messages,
    stream: opts.stream ?? false,
    options: {
      num_ctx: opts.numCtx ?? aiConfig.numCtx,
      temperature: opts.temperature ?? aiConfig.temperature,
      top_p: aiConfig.topP,
    },
  };
}

/**
 * Metinleri vektöre çevirir. Ollama sürümüne göre `/api/embed` veya eski
 * `/api/embeddings` uçlarından hangisi varsa o kullanılır.
 */
export async function embed(model: string, inputs: string[]): Promise<number[][]> {
  const res = await request('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: inputs }),
  });

  if (res.ok) {
    const data = await res.json();
    if (Array.isArray(data.embeddings)) return data.embeddings;
  }

  // Eski sürüm: tek tek, /api/embeddings
  const out: number[][] = [];
  for (const input of inputs) {
    const legacy = await request('/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: input }),
    });
    if (!legacy.ok) throw new Error(`Gömme hatası (${legacy.status}): ${await legacy.text()}`);
    out.push((await legacy.json()).embedding ?? []);
  }
  return out;
}

/** Hata metni "model belleğe sığmadı" anlamına geliyor mu? */
export function isCapacityError(message: string): boolean {
  return /signal: killed|out of memory|more system memory|failed to load model|no available devices|model requires more|bağlantısı koptu|ECONNRESET|UND_ERR_SOCKET/i.test(
    message
  );
}

/**
 * Kurulu en küçük sohbet modeli.
 *
 * Yapılandırılmış model makinenin belleğine sığmadığında son çare olarak
 * kullanılır: asistan tamamen susmaktansa daha küçük bir modelle yanıt verir
 * ve durum kullanıcıya bildirilir.
 */
export async function smallestChatModel(exclude: string): Promise<OllamaModel | null> {
  const models = await listModels();
  const candidates = models
    .filter((m) => m.name !== exclude)
    .filter((m) => !m.capabilities || m.capabilities.includes('completion'))
    // Gömme modelleri sohbet edemez.
    .filter((m) => !/embed/i.test(m.name))
    .sort((a, b) => a.size - b.size);
  return candidates[0] ?? null;
}

const contextLengthCache = new Map<string, number>();

/**
 * Modelin gerçek context penceresi (token).
 *
 * Bağlamı buna göre boyutlandırmak şart: yapılandırılmış `num_ctx` modelin
 * penceresinden büyükse fazla metin sessizce kırpılır ve model, gönderildiğini
 * sandığımız verinin bir kısmını hiç görmez. Küçük bir modele düşüldüğünde
 * (ör. 8K pencereli gemma2:2b) bu fark kritik hâle gelir.
 *
 * Değer okunamazsa null döner ve yapılandırılmış değer kullanılır.
 */
export async function getModelContextLength(model: string): Promise<number | null> {
  const cached = contextLengthCache.get(model);
  if (cached) return cached;

  try {
    const res = await request(
      '/api/show',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      },
      15_000
    );
    if (!res.ok) return null;

    const data = await res.json();
    // Anahtar aileye göre değişir: "gemma3.context_length", "llama.context_length"...
    const info = data.model_info ?? {};
    const key = Object.keys(info).find((k) => k.endsWith('.context_length'));
    const value = Number(key ? info[key] : data.details?.context_length);

    if (!Number.isFinite(value) || value <= 0) return null;
    contextLengthCache.set(model, value);
    return value;
  } catch {
    return null;
  }
}
