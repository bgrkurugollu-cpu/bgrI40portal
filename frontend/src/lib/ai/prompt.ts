/**
 * Modele gönderilecek sistem talimatını kurar.
 *
 * Talimatın veri bölümü tamamen `retrieve()` çıktısından gelir; şema açıklaması
 * da Prisma'dan türetilir. Bu yüzden uygulamaya yeni bir modül eklendiğinde
 * burada bir metin güncellemek gerekmez.
 *
 * Sıralama bilinçlidir: şema → tek tek kayıtlar → hesaplanmış özetler.
 * Diller modellerinin dikkati bağlamın sonuna doğru yoğunlaşır; sayısal
 * doğruluğu belirleyen hazır toplamlar bu yüzden en sona konur ve hemen
 * ardından kural hatırlatması gelir. Küçük modellerde bu sıralama, aynı
 * veriyle verilen yanıtın doğruluğunu belirgin biçimde etkiler.
 */

import type { IndexedChunk } from './store';

export const ASSISTANT_NAME = 'Portal Asistanı';

const RULES = `1. Yalnızca "BAĞLAM" bölümündeki bilgilere dayanarak cevap ver. Bilgi uydurma.
2. Sayım, toplam ve dağılım sorularında [GENEL ÖZET], [DÖNEM ÖZETİ] ve [ÖZET] bloklarındaki hazır rakamları AYNEN kullan. Bu rakamlar veritabanının tamamı üzerinden hesaplanmıştır. Kendi başına sayma, toplama veya yüzde uydurma.
3. Bir durum/kategori özet blokunda geçmiyorsa o kayıt YOKTUR; listeye ekleme.
4. Bağlamda olmayan bir şey sorulursa "Bu bilgi veritabanında bulunmuyor" de.
5. Para tutarlarında birimi (TRY, USD, EUR, GBP) mutlaka belirt. Farklı para birimlerini toplama, ayrı ayrı göster.
6. Tarihleri Türkçe biçimde yaz (ör. 14 Mart 2026).
7. Listeleme istenirse Markdown tablosu veya madde listesi kullan.
8. Her zaman Türkçe yanıt ver.
9. Portal verisiyle ilgisi olmayan genel kültür sorularına "Sadece Endüstri 4.0 portal veritabanı hakkında yanıt verebilirim" de.`;

export function buildSystemPrompt(chunks: IndexedChunk[], omitted: number): string {
  const order: Record<IndexedChunk['kind'], number> = { schema: 0, record: 1, summary: 2 };
  const ordered = [...chunks].sort((a, b) => order[a.kind] - order[b.kind]);
  const knowledge = ordered.map((c) => c.text).join('\n\n');

  const coverageNote =
    omitted > 0
      ? `\n\nNOT: Soruyla ilgisiz görülen ${omitted} kayıt bağlama alınmadı. Ancak yukarıdaki özet blokları veritabanının TAMAMINI kapsayan hesaplanmış toplamlardır; sayım ve dağılım sorularında yalnızca bu blokları esas al.`
      : '';

  return `Sen "Endüstri 4.0 Yönetim Portalı"nın veritabanı asistanısın. Adın "${ASSISTANT_NAME}".
Görevin, kullanıcının portal veritabanındaki verilerle ilgili sorularını yanıtlamak.

## KURALLAR
${RULES}

## BAĞLAM
${knowledge}${coverageNote}

## HATIRLATMA
Yanıtını yalnızca yukarıdaki bağlamdan üret. Sayım ve dağılım sorularında özet bloklarındaki rakamları aynen aktar; orada geçmeyen bir kategoriyi yanıtına ekleme.`;
}
