import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Fetch DB Summary
    const [projects, factories, members, licenses, invoices] = await Promise.all([
      prisma.project.findMany({
        select: { projectCode: true, name: true, status: true, riskLevel: true, targetBudget: true }
      }),
      prisma.factory.findMany({ select: { name: true, location: true } }),
      prisma.teamMember.findMany({ select: { name: true, title: true, active: true } }),
      prisma.license.findMany({ 
        select: { application: { select: { name: true } }, status: true } 
      }), // Omitting sensitive license keys just in case
      prisma.invoice.findMany({
        select: { project: { select: { name: true } }, description: true, amount: true, currency: true, issueDate: true, status: true }
      })
    ]);

    const dbSummary = `
Sistemdeki Güncel Veritabanı Özeti:
- Projeler: ${JSON.stringify(projects)}
- Fabrikalar: ${JSON.stringify(factories)}
- Takım Üyeleri: ${JSON.stringify(members)}
- Lisanslar: ${JSON.stringify(licenses)}
- Faturalar: ${JSON.stringify(invoices)}
`;

    const systemPrompt = `Sen I4.0 portal projesinin veritabanı asistanısın. SADECE aşağıdaki veritabanı özetinde bulunan verilere göre cevap vermelisin. Eğer soru bu verilerde geçmiyorsa "Sadece I4.0 portal projesindeki verilerle ilgili yanıt verebilirim" demelisin.

${dbSummary}
`;

    // Küçük modeller system prompt'u unutabildiği için son kullanıcı mesajına çok katı bir kural (prompt injection) ekliyoruz.
    const modifiedMessages = [...messages];
    const lastUserMessageIndex = modifiedMessages.findLastIndex((m: any) => m.role === 'user');
    if (lastUserMessageIndex !== -1) {
      modifiedMessages[lastUserMessageIndex].content = `${modifiedMessages[lastUserMessageIndex].content}
      
[KESİN TALİMAT: Sadece I4.0 portal veritabanı içindeki bilgilerle cevap ver. Veritabanı dışında (Paris, Dünya, genel kültür vb.) bir şey soruluyorsa veya bilmiyorsan, SADECE şu cümleyi söyle: "Sadece I4.0 portal projesindeki verilerle ilgili yanıt verebilirim"]`;
    }

    const messagesWithContext = [
      { role: 'system', content: systemPrompt },
      ...modifiedMessages
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

