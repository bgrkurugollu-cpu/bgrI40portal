/**
 * GET /api/chat/health — asistanın uçtan uca sağlık kontrolü.
 *
 * Ollama'ya erişilebiliyor mu, hangi model kullanılacak, bilgi tabanı hazır mı
 * ve gömme modeli var mı — hepsi tek çağrıda. Sorun giderirken ilk bakılacak uç.
 */

import { NextResponse } from 'next/server';
import { aiConfig } from '@/lib/ai/config';
import {
  getModelContextLength,
  getVersion,
  listModels,
  resolveChatModel,
  resolveEmbedModel,
} from '@/lib/ai/ollama';
import { peekIndex } from '@/lib/ai/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const version = await getVersion();
  const problems: string[] = [];

  if (!version) {
    problems.push(
      `Ollama'ya ${aiConfig.baseUrl} adresinden ulaşılamıyor. Sunucunun çalıştığından ve OLLAMA_URL değerinin doğru olduğundan emin olun.`
    );
    return NextResponse.json(
      { ok: false, ollama: { url: aiConfig.baseUrl, reachable: false }, problems },
      { status: 503 }
    );
  }

  let installed: string[] = [];
  let chatModel: Awaited<ReturnType<typeof resolveChatModel>> | null = null;
  try {
    installed = (await listModels(true)).map((m) => m.name);
    chatModel = await resolveChatModel();
    if (chatModel.fallback && chatModel.note) problems.push(chatModel.note);
  } catch (error: any) {
    problems.push(error?.message ?? 'Model listesi alınamadı.');
  }

  const embedModel = await resolveEmbedModel();
  // "none" bilinçli bir tercihtir (bellek tasarrufu); sorun olarak raporlanmaz.
  const embeddingDisabled = !aiConfig.embedModel || aiConfig.embedModel.toLowerCase() === 'none';
  if (!embedModel && !embeddingDisabled) {
    problems.push(
      `Gömme modeli "${aiConfig.embedModel}" kurulu değil. Asistan çalışır ancak anlamsal arama yerine sözcük tabanlı arama kullanır. Kurmak için: ollama pull ${aiConfig.embedModel}`
    );
  }

  const index = peekIndex();

  return NextResponse.json({
    ok: problems.length === 0,
    ollama: { url: aiConfig.baseUrl, reachable: true, version, installed },
    chat: chatModel
      ? {
          requested: chatModel.requested,
          using: chatModel.name,
          fallback: chatModel.fallback,
          // Modelin gerçek penceresi; bağlam buna göre boyutlandırılır.
          modelContextLength: await getModelContextLength(chatModel.name),
        }
      : null,
    embedding: {
      requested: aiConfig.embedModel,
      using: embedModel,
      enabled: !!embedModel,
      // Kapalıysa sebebi: ayarla kapatıldı mı, yoksa model bulunamadı mı?
      note: embeddingDisabled
        ? 'Anlamsal arama ayarla kapatılmış (OLLAMA_EMBED_MODEL=none); sözcük tabanlı arama kullanılıyor.'
        : embedModel
          ? null
          : 'Gömme modeli bulunamadı; sözcük tabanlı aramaya düşüldü.',
    },
    limits: {
      numCtx: aiConfig.numCtx,
      contextBudgetChars: aiConfig.contextBudgetChars,
      retrievalTopK: aiConfig.retrievalTopK,
      freshnessCheckMs: aiConfig.freshnessCheckMs,
    },
    index: index
      ? {
          built: true,
          builtAt: new Date(index.builtAt).toISOString(),
          buildMs: index.buildMs,
          records: index.stats.records,
          summaries: index.stats.summaries,
          embedding: { status: index.embedStatus, model: index.embedModel, embedded: index.embeddedCount },
          warnings: index.warnings,
        }
      : { built: false, note: 'Bilgi tabanı henüz kurulmadı; ilk soruda otomatik kurulur.' },
    problems,
  });
}
