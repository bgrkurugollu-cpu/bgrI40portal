/**
 * /api/chat/index — bilgi tabanının durumu ve elle yenilenmesi.
 *
 * GET  : indeksin güncel durumu. `?refresh=1` verilirse önce veri imzası
 *        kontrol edilir (değiştiyse indeks yeniden kurulur).
 *        `?preview=<soru>` verilirse, o soru için modele gönderilecek bağlam
 *        döner — "model yanlış cevap veriyor" durumunda, sorunun veri
 *        seçiminde mi yoksa modelin kendisinde mi olduğunu ayırt etmek için.
 * POST : indeksi koşulsuz yeniden kurar. Normalde gerekmez — indeks veri
 *        değiştiğinde kendiliğinden yenilenir; bu uç toplu içe aktarma
 *        sonrası anında tazelemek isteyenler için.
 */

import { NextResponse } from 'next/server';
import { shortFingerprint } from '@/lib/ai/fingerprint';
import { retrieve } from '@/lib/ai/retrieve';
import { getIndex, peekIndex } from '@/lib/ai/store';
import type { KnowledgeIndex } from '@/lib/ai/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function describe(index: KnowledgeIndex) {
  const byModel: Record<string, number> = {};
  for (const chunk of index.chunks) {
    if (chunk.kind !== 'record' || !chunk.model) continue;
    byModel[chunk.model] = (byModel[chunk.model] ?? 0) + 1;
  }

  return {
    built: true,
    builtAt: new Date(index.builtAt).toISOString(),
    buildMs: index.buildMs,
    fingerprint: shortFingerprint(index.fingerprint),
    fingerprintSource: index.fingerprintSource,
    chunks: index.chunks.length,
    records: index.stats.records,
    summaries: index.stats.summaries,
    totalChars: index.stats.totalChars,
    recordsByTable: byModel,
    embedding: {
      status: index.embedStatus,
      model: index.embedModel,
      embedded: index.embeddedCount,
      total: index.chunks.length,
    },
    warnings: index.warnings,
  };
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;

  // Bir soru için modele ne gönderileceğini göster.
  const preview = params.get('preview');
  if (preview) {
    const index = await getIndex();
    const budget = Number(params.get('budget')) || undefined;
    // full=1: sadece sabitlenmiş değil, seçilen tüm parçaların metnini göster.
    const full = params.get('full') === '1';
    const result = await retrieve(index, preview, budget);
    return NextResponse.json({
      question: preview,
      mode: result.mode,
      budgetChars: result.budgetChars,
      usedChars: result.usedChars,
      selected: result.chunks.length,
      omitted: result.omitted,
      chunks: result.chunks.map((c) => ({
        kind: c.kind,
        pinned: c.pinned,
        title: c.title,
        chars: c.text.length,
        // Sabitlenmiş parçaların (şema, genel özet) tam metni; doğruluk
        // sorunlarının çoğu burada görünür.
        text: full || c.pinned ? c.text : undefined,
      })),
    });
  }

  const refresh = params.get('refresh');
  if (refresh === '1' || refresh === 'true') {
    return NextResponse.json(describe(await getIndex()));
  }

  const index = peekIndex();
  if (!index) {
    return NextResponse.json({
      built: false,
      note: 'Bilgi tabanı henüz kurulmadı. İlk soruda ya da POST /api/chat/index ile kurulur.',
    });
  }
  return NextResponse.json(describe(index));
}

export async function POST() {
  const index = await getIndex(true);
  return NextResponse.json({ rebuilt: true, ...describe(index) });
}
