import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Fetch DB Summary
    const [projects, factories, members, licenses] = await Promise.all([
      prisma.project.findMany({
        select: { projectCode: true, name: true, status: true, riskLevel: true, targetBudget: true }
      }),
      prisma.factory.findMany({ select: { name: true, location: true } }),
      prisma.teamMember.findMany({ select: { name: true, title: true, active: true } }),
      prisma.license.findMany({ 
        select: { application: { select: { name: true } }, status: true } 
      }) // Omitting sensitive license keys just in case
    ]);

    const dbSummary = `
Sistemdeki Güncel Veritabanı Özeti:
- Projeler: ${JSON.stringify(projects)}
- Fabrikalar: ${JSON.stringify(factories)}
- Takım Üyeleri: ${JSON.stringify(members)}
- Lisanslar: ${JSON.stringify(licenses)}
`;

    const systemPrompt = `Sen Endüstri 4.0 yönetim portalının akıllı asistanısın. Görevin, SADECE aşağıda verilen 'Sistemdeki Güncel Veritabanı Özeti' bilgilerini kullanarak kullanıcının sorularını yanıtlamaktır. Eğer kullanıcının sorusunun cevabı aşağıdaki verilerde YOKSA, kesinlikle dışarıdan bilgi kullanma veya uydurma, sadece kibarca 'Maalesef bu bilgi sistem kayıtlarında (veritabanında) bulunmuyor' de.

${dbSummary}
`;

    const messagesWithContext = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemma2:2b',
        messages: messagesWithContext,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama Error Response:', errorText);
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

