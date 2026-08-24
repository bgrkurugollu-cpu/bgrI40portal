/**
 * Bilgi tabanının canlı önbelleği.
 *
 * Kendi kendini güncelleme mantığı burada: her soruda önce veritabanının
 * imzası okunur (tek, çok ucuz sorgu). İmza öncekiyle aynıysa hazır indeks
 * kullanılır; değişmişse indeks o anda yeniden kurulur. Yani uygulamada bir
 * kayıt değiştiği anda asistan bir sonraki soruda güncel veriyi görür —
 * elle "yeniden eğit" adımı yoktur.
 *
 * Gömme (embedding) hesabı indeksi BEKLETMEZ. Kayıtlar hazır olur olmaz
 * indeks kullanılabilir hâle gelir ve sorular sözcük tabanlı aramayla
 * yanıtlanır; vektörler arka planda dolar ve tamamlandıkça anlamsal arama
 * kendiliğinden devreye girer. Aksi hâlde ilk soru, binlerce kaydın
 * gömülmesini beklemek zorunda kalırdı.
 *
 * Vektörler metin özetine göre yeniden kullanılır: 500 kayıtlık bir tabloda
 * tek satır değişirse yalnızca o satır yeniden gömülür.
 */

import { aiConfig } from './config';
import { computeFingerprint, hash, type Fingerprint } from './fingerprint';
import { buildKnowledge, type Chunk } from './knowledge';
import { embed, resolveEmbedModel } from './ollama';
import { waitForIdle } from './scheduler';

export interface IndexedChunk extends Chunk {
  /** Sözcük tabanlı arama için normalize edilmiş jetonlar. */
  tokens: string[];
  vector?: number[];
}

export type EmbeddingStatus = 'kapalı' | 'sürüyor' | 'hazır' | 'hata';

export interface KnowledgeIndex {
  fingerprint: string;
  fingerprintSource: Fingerprint['source'];
  builtAt: number;
  /** Kayıtların hazırlanma süresi (gömme hariç). */
  buildMs: number;
  chunks: IndexedChunk[];
  /** Gömme modeli bulunamadıysa null; sistem sözcük aramasıyla çalışır. */
  embedModel: string | null;
  embedStatus: EmbeddingStatus;
  embeddedCount: number;
  /** Ters belge frekansı — sözcük aramasında ayırt edici kelimeleri öne çıkarır. */
  idf: Map<string, number>;
  stats: { records: number; summaries: number; totalChars: number };
  warnings: string[];
  /** Bu indeksin sürümü; eski gömme işlerini iptal etmek için. */
  generation: number;
}

interface StoreState {
  index: KnowledgeIndex | null;
  lastCheckedAt: number;
  building: Promise<KnowledgeIndex> | null;
  generation: number;
  /** Metin özeti → vektör. Yeniden kurulumda değişmeyen kayıtlar için. */
  vectorCache: Map<string, number[]>;
}

// Next.js geliştirme modunda modüller yeniden yüklendiği için durum global'de tutulur.
const globalForAi = globalThis as unknown as { __aiStore?: StoreState };

const state: StoreState = (globalForAi.__aiStore ??= {
  index: null,
  lastCheckedAt: 0,
  building: null,
  generation: 0,
  vectorCache: new Map(),
});

/** Türkçe metni arama için sadeleştirir. */
export function tokenize(text: string): string[] {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((t) => t.length > 1);
}

function buildIdf(chunks: IndexedChunk[]): Map<string, number> {
  const docFreq = new Map<string, number>();
  for (const chunk of chunks) {
    for (const token of new Set(chunk.tokens)) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  const total = chunks.length || 1;
  for (const [token, freq] of docFreq) {
    idf.set(token, Math.log(1 + total / (1 + freq)));
  }
  return idf;
}

/**
 * Vektörleri arka planda doldurur.
 *
 * İndeks nesnesi yerinde güncellenir; her partiden sonra o parçalar aramada
 * kullanılabilir hâle gelir. Yeni bir indeks kurulduysa (generation değiştiyse)
 * iş sessizce bırakılır.
 */
async function fillEmbeddings(index: KnowledgeIndex): Promise<void> {
  const model = await resolveEmbedModel();
  if (!model) {
    index.embedStatus = 'kapalı';
    index.warnings.push(
      `Gömme modeli "${aiConfig.embedModel}" kurulu değil; anlamsal arama yerine sözcük tabanlı arama kullanılıyor. Etkinleştirmek için: ollama pull ${aiConfig.embedModel}`
    );
    return;
  }

  index.embedModel = model;
  index.embedStatus = 'sürüyor';

  const pending: { chunk: IndexedChunk; key: string }[] = [];
  for (const chunk of index.chunks) {
    const key = hash(chunk.text);
    const cached = state.vectorCache.get(key);
    if (cached) chunk.vector = cached;
    else pending.push({ chunk, key });
  }
  index.embeddedCount = index.chunks.filter((c) => c.vector).length;

  // Küçük partiler: her parti Ollama'da sıraya girer ve süren bir partiyi
  // bölemeyiz. Parti ne kadar küçükse, araya giren bir kullanıcı sorusu o
  // kadar az bekler (parti başına ~1-2 sn).
  const BATCH = 4;
  try {
    for (let i = 0; i < pending.length; i += BATCH) {
      // Bu indeks artık güncel değilse boşuna hesaplama yapma.
      if (index.generation !== state.generation) return;

      // Kullanıcı sorusu varsa Ollama'yı ona bırak; soru bitince devam et.
      await waitForIdle();

      const slice = pending.slice(i, i + BATCH);
      const vectors = await embed(model, slice.map((p) => p.chunk.text));
      slice.forEach((p, idx) => {
        const vector = vectors[idx];
        if (!vector) return;
        p.chunk.vector = vector;
        state.vectorCache.set(p.key, vector);
      });
      index.embeddedCount = index.chunks.filter((c) => c.vector).length;
    }
    index.embedStatus = 'hazır';
  } catch (error: any) {
    index.embedStatus = 'hata';
    index.warnings.push(
      `Gömme sırasında hata: ${error?.message ?? error}. Sözcük tabanlı aramayla devam ediliyor.`
    );
  } finally {
    // Artık kullanılmayan vektörleri at, önbellek sınırsız büyümesin.
    const live = new Set(index.chunks.map((c) => hash(c.text)));
    for (const key of state.vectorCache.keys()) {
      if (!live.has(key)) state.vectorCache.delete(key);
    }
  }
}

async function build(fingerprint: Fingerprint): Promise<KnowledgeIndex> {
  const startedAt = Date.now();
  const generation = ++state.generation;

  const { chunks, stats } = await buildKnowledge();
  const indexed: IndexedChunk[] = chunks.map((c) => ({ ...c, tokens: tokenize(c.text) }));

  const index: KnowledgeIndex = {
    fingerprint: fingerprint.value,
    fingerprintSource: fingerprint.source,
    builtAt: Date.now(),
    buildMs: Date.now() - startedAt,
    chunks: indexed,
    embedModel: null,
    embedStatus: 'sürüyor',
    embeddedCount: 0,
    idf: buildIdf(indexed),
    stats,
    warnings: [],
    generation,
  };

  // Gömme arka planda; indeks hemen kullanılabilir.
  void fillEmbeddings(index).catch(() => {
    index.embedStatus = 'hata';
  });

  return index;
}

/**
 * Güncel indeksi verir; gerekiyorsa yeniden kurar.
 *
 * @param force `true` ise imza kontrolü atlanır ve indeks koşulsuz yenilenir.
 */
export async function getIndex(force = false): Promise<KnowledgeIndex> {
  // Aynı anda gelen isteklerin aynı indeksi iki kez kurmasını engelle.
  if (state.building && !force) return state.building;

  const withinThrottle = Date.now() - state.lastCheckedAt < aiConfig.freshnessCheckMs;
  if (!force && state.index && withinThrottle) return state.index;

  const fingerprint = await computeFingerprint();
  state.lastCheckedAt = Date.now();

  if (!force && state.index && state.index.fingerprint === fingerprint.value) {
    return state.index;
  }

  const job = build(fingerprint)
    .then((index) => {
      state.index = index;
      return index;
    })
    .finally(() => {
      state.building = null;
    });

  state.building = job;
  return job;
}

/** İndeksi yeniden kurmadan mevcut durumunu bildirir (teşhis uçları için). */
export function peekIndex(): KnowledgeIndex | null {
  return state.index;
}

/** Bir sonraki istekte indeksin yeniden kurulmasını zorlar. */
export function invalidateIndex(): void {
  state.index = null;
  state.lastCheckedAt = 0;
}
