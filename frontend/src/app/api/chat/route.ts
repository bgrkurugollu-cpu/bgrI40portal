/**
 * POST /api/chat — "Bana Sor" asistanının ana ucu.
 *
 * Akış: veri imzası kontrol edilir (değiştiyse bilgi tabanı yeniden kurulur) →
 * kullanılacak model ve onun gerçek context penceresi belirlenir → o pencereye
 * sığacak kadar ilgili kayıt seçilir → lokal Ollama modeline sorulur.
 *
 * `stream: true` gönderilirse yanıt NDJSON olarak parça parça akar; aksi
 * hâlde tek bir JSON döner.
 */

import { NextResponse } from 'next/server';
import { aiConfig } from '@/lib/ai/config';
import {
  chat,
  getModelContextLength,
  isCapacityError,
  openChatStream,
  resolveChatModel,
  smallestChatModel,
  type ChatMessage,
} from '@/lib/ai/ollama';
import { shortFingerprint } from '@/lib/ai/fingerprint';
import { buildSystemPrompt } from '@/lib/ai/prompt';
import { retrieve, type RetrievalResult } from '@/lib/ai/retrieve';
import { beginInteractive, endInteractive } from '@/lib/ai/scheduler';
import { getIndex, type KnowledgeIndex } from '@/lib/ai/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Context penceresinin bağlama ayrılan payı; gerisi sohbet geçmişi ve yanıt için. */
const CONTEXT_SHARE = 0.55;
/**
 * Karakter → token dönüşüm oranı.
 *
 * Ölçüm: bu veritabanının Türkçe bağlamında 14.000 karakter 6.498 token etti,
 * yani token başına ~2.15 karakter. Türkçe, İngilizceye göre çok daha kötü
 * tokenize olur (ekler ayrı token'lara bölünür); İngilizce için sık kullanılan
 * ~4 karakter varsayımı burada bağlamın pencereye sığdığını sanıp taşmasına
 * ve sessizce kırpılmasına yol açar. Güvenli tarafta kalmak için 2.15 değil
 * 2.0 alınır.
 */
const CHARS_PER_TOKEN = 2.0;

interface IncomingMessage {
  role?: string;
  content?: string;
}

function normalizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m: IncomingMessage) => typeof m?.content === 'string' && m.content.trim())
    .map((m: IncomingMessage) => ({
      // İstemci geçmişte "model" rolünü kullanıyordu; Ollama "assistant" bekler.
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content).trim(),
    })) as ChatMessage[];
}

interface Prepared {
  numCtx: number;
  retrieval: RetrievalResult;
  payload: ChatMessage[];
}

/**
 * Bağlamı, gerçekte kullanılacak modelin penceresine göre hazırlar.
 *
 * Yapılandırılmış `num_ctx` modelin desteklediğinden büyükse fazlası sessizce
 * kırpılır; bu yüzden ikisinin küçüğü alınır ve karakter bütçesi ona göre
 * hesaplanır. Küçük bir modele düşüldüğünde bağlam kendiliğinden daralır.
 */
async function prepare(
  model: string,
  index: KnowledgeIndex,
  question: string,
  history: ChatMessage[]
): Promise<Prepared> {
  const modelCtx = await getModelContextLength(model);
  const numCtx = modelCtx ? Math.min(aiConfig.numCtx, modelCtx) : aiConfig.numCtx;
  const budgetChars = Math.min(
    aiConfig.contextBudgetChars,
    Math.floor(numCtx * CHARS_PER_TOKEN * CONTEXT_SHARE)
  );

  const retrieval = await retrieve(index, question, budgetChars);
  const systemPrompt = buildSystemPrompt(retrieval.chunks, retrieval.omitted);

  return {
    numCtx,
    retrieval,
    payload: [{ role: 'system', content: systemPrompt }, ...history],
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const messages = normalizeMessages(body?.messages);
    const wantsStream = body?.stream === true;

    if (messages.length === 0) {
      return NextResponse.json({ error: 'En az bir mesaj gönderilmelidir.' }, { status: 400 });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) {
      return NextResponse.json({ error: 'Kullanıcı mesajı bulunamadı.' }, { status: 400 });
    }

    // Veri değiştiyse bilgi tabanı burada kendiliğinden yeniden kurulur.
    const index = await getIndex();

    // Buradan sonrası Ollama'yı meşgul eder; etkileşimli olarak işaretlenir ki
    // arka planda süren gömme işi kuyruğu tıkamasın.
    beginInteractive();
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      endInteractive();
    };

    try {
      const resolved = await resolveChatModel();
      // Uzun sohbetlerde bağlamı taşırmamak için son 10 tur tutulur.
      const history = messages.slice(-10);

      let usedModel = resolved.name;
      let capacityNote: string | null = null;
      let prepared = await prepare(usedModel, index, lastUser.content, history);

      /**
       * İşi çalıştırır; model belleğe sığmazsa kurulu en küçük modelle bir kez
       * daha dener. İkinci denemede bağlam, küçük modelin penceresine göre
       * yeniden hazırlanır.
       */
      const run = async <T>(fn: (model: string, numCtx: number) => Promise<T>): Promise<T> => {
        try {
          return await fn(usedModel, prepared.numCtx);
        } catch (error: any) {
          const message = String(error?.message ?? error);
          if (!isCapacityError(message)) throw error;

          const smaller = await smallestChatModel(usedModel);
          if (!smaller) throw error;

          capacityNote =
            `"${usedModel}" bu makinenin belleğine sığmadı; yanıt daha küçük "${smaller.name}" ` +
            `modeliyle üretildi. Tam kapasite için Docker Desktop belleğini artırın ` +
            `veya Ollama'yı hostta çalıştırın.`;
          usedModel = smaller.name;
          prepared = await prepare(usedModel, index, lastUser.content, history);
          return await fn(usedModel, prepared.numCtx);
        }
      };

      const buildMeta = () => ({
        model: usedModel,
        numCtx: prepared.numCtx,
        modelFallback:
          [resolved.fallback ? resolved.note : null, capacityNote].filter(Boolean).join(' ') || null,
        retrieval: {
          mode: prepared.retrieval.mode,
          chunks: prepared.retrieval.chunks.length,
          chars: prepared.retrieval.usedChars,
          omitted: prepared.retrieval.omitted,
          budget: prepared.retrieval.budgetChars,
        },
        index: {
          fingerprint: shortFingerprint(index.fingerprint),
          source: index.fingerprintSource,
          builtAt: new Date(index.builtAt).toISOString(),
          buildMs: index.buildMs,
          records: index.stats.records,
          summaries: index.stats.summaries,
          embedModel: index.embedModel,
          embedStatus: index.embedStatus,
          warnings: index.warnings,
        },
      });

      if (!wantsStream) {
        const result = await run((model, numCtx) =>
          chat({ model, messages: prepared.payload, numCtx })
        );
        release();
        return NextResponse.json({
          message: { role: 'assistant', content: result.content },
          meta: buildMeta(),
          done: true,
        });
      }

      // Akış başlamadan önce modeli açarak yükleme hatalarını yakala; böylece
      // gerekirse daha küçük modele düşmek hâlâ mümkün.
      const generator = await run((model, numCtx) =>
        openChatStream({ model, messages: prepared.payload, numCtx })
      );

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (obj: unknown) =>
            controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
          try {
            send({ meta: buildMeta(), done: false });
            for await (const piece of generator) {
              send({ message: { role: 'assistant', content: piece }, done: false });
            }
            send({ done: true });
          } catch (error: any) {
            send({ error: error?.message ?? 'Model yanıt veremedi.', done: true });
          } finally {
            release();
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-store, no-transform',
        },
      });
    } catch (error) {
      release();
      throw error;
    }
  } catch (error: any) {
    console.error('[Bana Sor] Hata:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Beklenmeyen bir hata oluştu.' },
      { status: 500 }
    );
  }
}
