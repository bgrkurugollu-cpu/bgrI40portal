/**
 * Soruyla ilgili bilgi parçalarını seçer.
 *
 * İki sinyal birleştirilir:
 *  - sözcük eşleşmesi (idf ağırlıklı) — "BGR-014" gibi kodlarda kesin isabet
 *  - anlamsal benzerlik (gömme vektörü) — "hangi projeler riskli" gibi
 *    kelimesi geçmeyen sorularda isabet
 *
 * Gömme modeli kurulu değilse sistem sessizce sadece sözcük eşleşmesine düşer.
 * Sabitlenmiş (`pinned`) parçalar — şema ve genel özet — her zaman gönderilir,
 * böylece model toplam/sayım sorularını her koşulda yanıtlayabilir.
 */

import { aiConfig } from './config';
import { embed } from './ollama';
import { tokenize, type IndexedChunk, type KnowledgeIndex } from './store';

export interface RetrievalResult {
  chunks: IndexedChunk[];
  usedChars: number;
  /** Bütçe dolduğu için dışarıda kalan parça sayısı. */
  omitted: number;
  /** Bu seçimde uygulanan karakter bütçesi. */
  budgetChars: number;
  mode: 'hibrit' | 'sözcük';
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function lexicalScore(chunk: IndexedChunk, queryTokens: string[], idf: Map<string, number>): number {
  if (queryTokens.length === 0) return 0;
  const present = new Set(chunk.tokens);
  let score = 0;
  let maxScore = 0;
  for (const token of queryTokens) {
    const weight = idf.get(token) ?? 1;
    maxScore += weight;
    if (present.has(token)) {
      score += weight;
      continue;
    }
    // Ek/çekim farklarını tolere et: "projenin" ⇒ "proje"
    if (token.length >= 5 && chunk.tokens.some((t) => t.startsWith(token.slice(0, 5)))) {
      score += weight * 0.5;
    }
  }
  return maxScore === 0 ? 0 : score / maxScore;
}

/**
 * Soruyla ilgili parçaları seçer.
 *
 * @param budgetChars Bağlama konabilecek en fazla karakter. Kullanılacak
 *   modelin gerçek context penceresinden hesaplanır (bkz. route.ts).
 */
export async function retrieve(
  index: KnowledgeIndex,
  question: string,
  budgetChars: number = aiConfig.contextBudgetChars
): Promise<RetrievalResult> {
  const pinned = index.chunks.filter((c) => c.pinned);
  const candidates = index.chunks.filter((c) => !c.pinned);

  const queryTokens = tokenize(question);

  let queryVector: number[] | null = null;
  if (index.embedModel && index.embeddedCount > 0) {
    try {
      queryVector = (await embed(index.embedModel, [question]))[0] ?? null;
    } catch {
      queryVector = null; // gömme sunucusu yanıt vermezse sözcük aramasıyla devam
    }
  }

  const scored = candidates.map((chunk) => {
    const lexical = lexicalScore(chunk, queryTokens, index.idf);
    const semantic = queryVector && chunk.vector ? (cosine(queryVector, chunk.vector) + 1) / 2 : 0;

    let score = queryVector ? lexical * 0.55 + semantic * 0.45 : lexical;
    // Hesaplanmış toplamlar sayısal sorularda kayıt satırlarından daha değerli.
    if (chunk.kind === 'summary') score *= 1.15;

    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: IndexedChunk[] = [...pinned];
  let usedChars = pinned.reduce((s, c) => s + c.text.length + 2, 0);
  let omitted = 0;

  for (const { chunk, score } of scored.slice(0, aiConfig.retrievalTopK)) {
    if (score <= 0) continue;
    const cost = chunk.text.length + 2;
    if (usedChars + cost > budgetChars) {
      omitted++;
      continue;
    }
    selected.push(chunk);
    usedChars += cost;
  }

  omitted += Math.max(0, scored.length - aiConfig.retrievalTopK);

  return {
    chunks: selected,
    usedChars,
    omitted,
    budgetChars,
    mode: queryVector ? 'hibrit' : 'sözcük',
  };
}
