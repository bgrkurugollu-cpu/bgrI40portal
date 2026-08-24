/**
 * GET /api/chat/models — lokal Ollama sunucusunda kurulu modeller.
 *
 * Model seçimini env'den yapabilmek için hangi seçeneklerin mevcut olduğunu
 * ve o an hangisinin kullanıldığını gösterir.
 */

import { NextResponse } from 'next/server';
import { aiConfig } from '@/lib/ai/config';
import { listModels, resolveChatModel } from '@/lib/ai/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gb(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export async function GET() {
  try {
    const models = await listModels(true);
    const active = await resolveChatModel().catch(() => null);

    return NextResponse.json({
      url: aiConfig.baseUrl,
      configured: { chat: aiConfig.model, embedding: aiConfig.embedModel },
      active: active?.name ?? null,
      models: models.map((m) => ({
        name: m.name,
        size: m.size,
        sizeHuman: gb(m.size),
        parameterSize: m.parameterSize,
        quantization: m.quantization,
        family: m.family,
        capabilities: m.capabilities ?? [],
        active: m.name === active?.name,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Model listesi alınamadı.', url: aiConfig.baseUrl },
      { status: 503 }
    );
  }
}
