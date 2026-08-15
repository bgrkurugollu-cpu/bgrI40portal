import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Decimal } from '@prisma/client/runtime/library';
import { getInvoiceDerivedStatus } from '@/lib/utils';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// ── Yardımcı Fonksiyonlar ───────────────────────────────────────

/** Decimal tipini okunabilir sayıya çevirir */
function d(val: Decimal | number | null | undefined): string {
  if (val == null) return '0';
  return Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Tarih formatla */
function fmtDate(date: Date | string | null | undefined): string {
  if (!date) return 'Belirtilmemiş';
  return new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Ay numarasından Türkçe ay adı */
function monthName(m: number): string {
  const names = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  return names[m] || `${m}. Ay`;
}

// ── Enum Türkçe etiketler ───────────────────────────────────────

const STATUS_TR: Record<string, string> = {
  PLANNED: 'Planlandı', ACTIVE: 'Aktif', ON_HOLD: 'Beklemede',
  COMPLETED: 'Tamamlandı', CANCELLED: 'İptal Edildi',
};
const RISK_TR: Record<string, string> = {
  LOW: 'Düşük', MEDIUM: 'Orta', HIGH: 'Yüksek', CRITICAL: 'Kritik',
};
const PRIORITY_TR: Record<string, string> = {
  LOW: 'Düşük', MEDIUM: 'Orta', HIGH: 'Yüksek', CRITICAL: 'Kritik',
};
/** Fatura statüsünü ve planlanan tarihe göre türetilmiş durumu (Gecikti/Yaklaşıyor) RAG için düz metne çevirir */
function invStatusText(status: string, issueDate: Date | string): string {
  const derived = getInvoiceDerivedStatus(status, issueDate);
  return derived.description ? `${derived.label} (${derived.description})` : derived.label;
}
const LIC_STATUS_TR: Record<string, string> = {
  ACTIVE: 'Aktif', EXPIRING: 'Süresi Dolmak Üzere', EXPIRED: 'Süresi Doldu', CANCELLED: 'İptal',
};
const PAYMENT_TR: Record<string, string> = {
  MONTHLY: 'Aylık', QUARTERLY: '3 Aylık', YEARLY: 'Yıllık', ONE_TIME: 'Tek Seferlik',
};

// ── Veritabanından TÜM veriyi çek ───────────────────────────────

async function buildFullDatabaseContext(): Promise<string> {
  const [
    projects, factories, members, users,
    applications, licenses, invoices,
    budgetItems, financials, assignments, projectLogs,
  ] = await Promise.all([
    // 1. PROJELER — tüm ilişkilerle
    prisma.project.findMany({
      include: {
        factories: true,
        logs: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50, // Son 50 log yeterli
        },
        assignments: {
          include: { member: true },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        },
        budgetItems: true,
        financials: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        },
        invoices: {
          orderBy: { issueDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // 2. FABRİKALAR
    prisma.factory.findMany({
      include: {
        projects: { select: { name: true, projectCode: true } },
        licenses: { include: { application: true } },
      },
    }),

    // 3. TAKIM ÜYELERİ
    prisma.teamMember.findMany({
      include: {
        assignments: {
          include: { project: { select: { name: true, projectCode: true } } },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        },
      },
    }),

    // 4. KULLANICILAR (şifre hariç)
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    }),

    // 5. UYGULAMALAR
    prisma.application.findMany({
      include: {
        licenses: {
          include: { factories: true },
        },
      },
    }),

    // 6. LİSANSLAR (detaylı)
    prisma.license.findMany({
      include: {
        application: true,
        factories: true,
      },
    }),

    // 7. FATURALAR
    prisma.invoice.findMany({
      include: { project: { select: { name: true, projectCode: true } } },
      orderBy: { issueDate: 'desc' },
    }),

    // 8. BÜTÇE KALEMLERİ
    prisma.budgetItem.findMany({
      include: { project: { select: { name: true, projectCode: true } } },
    }),

    // 9. AYLIK FİNANSAL
    prisma.monthlyFinancial.findMany({
      include: { project: { select: { name: true, projectCode: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    }),

    // 10. EFOR ATAMALARI
    prisma.assignment.findMany({
      include: {
        project: { select: { name: true, projectCode: true } },
        member: true,
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    }),

    // 11. PROJE LOGLARI (son 100)
    prisma.projectLog.findMany({
      include: {
        project: { select: { name: true, projectCode: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  // ── Metin oluşturma ──────────────────────────────────────────

  const sections: string[] = [];
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  sections.push(`📅 Bugünün Tarihi: ${today}`);
  sections.push(`📊 Veritabanı Özet İstatistikler: ${projects.length} proje, ${factories.length} fabrika, ${members.length} takım üyesi, ${users.length} kullanıcı, ${applications.length} uygulama, ${licenses.length} lisans, ${invoices.length} fatura, ${budgetItems.length} bütçe kalemi`);

  // ── 1. PROJELER (detaylı) ─────────────────────────────────────
  sections.push('\n=== PROJELER ===');
  if (projects.length === 0) {
    sections.push('Henüz proje kaydı bulunmuyor.');
  }
  for (const p of projects) {
    const lines: string[] = [];
    lines.push(`▸ Proje Kodu: ${p.projectCode}`);
    lines.push(`  Ad: ${p.name}`);
    lines.push(`  Durum: ${STATUS_TR[p.status] || p.status}`);
    lines.push(`  Risk Seviyesi: ${RISK_TR[p.riskLevel] || p.riskLevel}`);
    lines.push(`  Öncelik: ${PRIORITY_TR[p.priority] || p.priority}`);
    lines.push(`  Gerçekleşme İhtimali: %${p.probability}`);
    lines.push(`  Hedef Bütçe: ${d(p.targetBudget)} TL`);
    lines.push(`  Başlangıç: ${fmtDate(p.startDate)}, Bitiş: ${fmtDate(p.endDate)}`);
    if (p.description) lines.push(`  Açıklama: ${p.description}`);
    lines.push(`  Oluşturma: ${fmtDate(p.createdAt)}, Son Güncelleme: ${fmtDate(p.updatedAt)}`);

    // Fabrikalar
    if (p.factories.length > 0) {
      lines.push(`  Fabrikalar: ${p.factories.map(f => f.name + (f.location ? ` (${f.location})` : '')).join(', ')}`);
    }

    // Bütçe Kalemleri
    if (p.budgetItems.length > 0) {
      lines.push(`  Bütçe Kalemleri (${p.budgetItems.length} adet):`);
      for (const bi of p.budgetItems) {
        lines.push(`    • ${bi.category} — ${bi.description}: ${d(bi.quantity)} adet × ${d(bi.unitPrice)} ${bi.currency} = ${d(bi.amount)} ${bi.currency} (Yıl: ${bi.year})`);
      }
      const totalBudget = p.budgetItems.reduce((sum, bi) => sum + Number(bi.amount), 0);
      lines.push(`    Toplam Bütçe Kalemleri Tutarı: ${totalBudget.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} (karışık para birimleri olabilir)`);
    }

    // Aylık Finansal
    if (p.financials.length > 0) {
      lines.push(`  Aylık Finansal Veriler (${p.financials.length} kayıt):`);
      for (const f of p.financials) {
        lines.push(`    • ${f.year}/${monthName(f.month)}: Gider ${d(f.expense)} ${f.currency}, Gelir ${d(f.income)} ${f.currency}, İç Kaynak Geliri ${d(f.internalIncome)} ${f.currency}`);
      }
    }

    // Efor Atamaları
    if (p.assignments.length > 0) {
      lines.push(`  Efor Atamaları (${p.assignments.length} kayıt):`);
      for (const a of p.assignments) {
        lines.push(`    • ${a.member.name}${a.member.title ? ` (${a.member.title})` : ''} — ${a.year}/${monthName(a.month)}: Plan ${d(a.plannedDays)} gün, Gerçekleşen ${d(a.actualDays)} gün${a.resources ? `, Kaynaklar: ${a.resources}` : ''}`);
      }
    }

    // Faturalar
    if (p.invoices.length > 0) {
      lines.push(`  Faturalar (${p.invoices.length} adet):`);
      for (const inv of p.invoices) {
        lines.push(`    • ${inv.description}: ${d(inv.amount)} ${inv.currency} — Durum: ${invStatusText(inv.status, inv.issueDate)}, Tarih: ${fmtDate(inv.issueDate)}${inv.ebaNumber ? `, EBA: ${inv.ebaNumber}` : ''}${inv.poNumber ? `, PO: ${inv.poNumber}` : ''}`);
      }
    }

    // Son değişiklik logları (en fazla 10)
    if (p.logs.length > 0) {
      const recentLogs = p.logs.slice(0, 10);
      lines.push(`  Son Değişiklik Logları (${p.logs.length} toplam, son ${recentLogs.length} gösterildi):`);
      for (const log of recentLogs) {
        lines.push(`    • ${fmtDate(log.createdAt)} — ${log.user?.name || 'Sistem'}: ${log.field} alanı "${log.oldValue || '-'}" → "${log.newValue || '-'}"`);
      }
    }

    sections.push(lines.join('\n'));
  }

  // ── 2. FABRİKALAR ────────────────────────────────────────────
  sections.push('\n=== FABRİKALAR ===');
  if (factories.length === 0) {
    sections.push('Henüz fabrika kaydı bulunmuyor.');
  }
  for (const f of factories) {
    const lines: string[] = [];
    lines.push(`▸ ${f.name}${f.location ? ` — Konum: ${f.location}` : ''}`);
    if (f.projects.length > 0) {
      lines.push(`  Bağlı Projeler: ${f.projects.map(p => `${p.name} (${p.projectCode})`).join(', ')}`);
    }
    if (f.licenses.length > 0) {
      lines.push(`  Bağlı Lisanslar: ${f.licenses.map(l => l.application.name).join(', ')}`);
    }
    sections.push(lines.join('\n'));
  }

  // ── 3. TAKIM ÜYELERİ ─────────────────────────────────────────
  sections.push('\n=== TAKIM ÜYELERİ ===');
  if (members.length === 0) {
    sections.push('Henüz takım üyesi kaydı bulunmuyor.');
  }
  for (const m of members) {
    const lines: string[] = [];
    lines.push(`▸ ${m.name}${m.title ? ` — Unvan: ${m.title}` : ''} — Durum: ${m.active ? 'Aktif' : 'Pasif'}`);
    if (m.assignments.length > 0) {
      // Projeye göre grupla
      const byProject = new Map<string, typeof m.assignments>();
      for (const a of m.assignments) {
        const key = a.project.name;
        if (!byProject.has(key)) byProject.set(key, []);
        byProject.get(key)!.push(a);
      }
      for (const [projName, assigns] of byProject) {
        const totalPlanned = assigns.reduce((s, a) => s + Number(a.plannedDays), 0);
        const totalActual = assigns.reduce((s, a) => s + Number(a.actualDays), 0);
        lines.push(`  ${projName}: Toplam Plan ${d(totalPlanned)} gün, Gerçekleşen ${d(totalActual)} gün (${assigns.length} ay)`);
      }
    }
    sections.push(lines.join('\n'));
  }

  // ── 4. KULLANICILAR ───────────────────────────────────────────
  sections.push('\n=== KULLANICILAR ===');
  for (const u of users) {
    sections.push(`▸ ${u.name} — E-posta: ${u.email}, Rol: ${u.role === 'ADMIN' ? 'Yönetici' : 'Kullanıcı'}, Kayıt: ${fmtDate(u.createdAt)}`);
  }

  // ── 5. UYGULAMALAR VE LİSANSLAR ──────────────────────────────
  sections.push('\n=== UYGULAMALAR VE LİSANSLAR ===');
  if (applications.length === 0) {
    sections.push('Henüz uygulama kaydı bulunmuyor.');
  }
  for (const app of applications) {
    const lines: string[] = [];
    lines.push(`▸ ${app.name}${app.vendor ? ` — Üretici: ${app.vendor}` : ''}`);
    if (app.licenses.length > 0) {
      lines.push(`  Lisanslar (${app.licenses.length} adet):`);
      for (const lic of app.licenses) {
        lines.push(`    • Durum: ${LIC_STATUS_TR[lic.status] || lic.status}`);
        lines.push(`      Yatırım Bedeli: ${d(lic.totalInvestment)} ${lic.currency}`);
        if (lic.isSubscription) {
          lines.push(`      Abonelik: Evet — ${d(lic.subscriptionCost)} ${lic.currency} / ${PAYMENT_TR[lic.paymentPeriod] || lic.paymentPeriod}`);
        }
        if (lic.renewalDate) {
          lines.push(`      Yenileme Tarihi: ${fmtDate(lic.renewalDate)}`);
        }
        if (lic.description) {
          lines.push(`      Açıklama: ${lic.description}`);
        }
        if (lic.factories.length > 0) {
          lines.push(`      Fabrikalar: ${lic.factories.map(f => f.name).join(', ')}`);
        }
      }
    }
    sections.push(lines.join('\n'));
  }

  // ── 6. TÜM FATURALAR (özet) ──────────────────────────────────
  sections.push('\n=== TÜM FATURALAR ===');
  if (invoices.length === 0) {
    sections.push('Henüz fatura kaydı bulunmuyor.');
  }
  for (const inv of invoices) {
    sections.push(`▸ ${inv.project?.name || 'Bilinmiyor'} (${inv.project?.projectCode || '?'}) — ${inv.description}: ${d(inv.amount)} ${inv.currency}, Durum: ${invStatusText(inv.status, inv.issueDate)}, Tarih: ${fmtDate(inv.issueDate)}${inv.ebaNumber ? `, EBA: ${inv.ebaNumber}` : ''}${inv.poNumber ? `, PO: ${inv.poNumber}` : ''}`);
  }

  // ── 7. TOPLU FİNANSAL ÖZET ────────────────────────────────────
  if (financials.length > 0) {
    sections.push('\n=== AYLIK FİNANSAL ÖZET (tüm projeler) ===');
    // Yıl-Ay bazında topla
    const byYearMonth = new Map<string, { expense: number; income: number; internalIncome: number }>();
    for (const f of financials) {
      const key = `${f.year}/${monthName(f.month)}`;
      const existing = byYearMonth.get(key) || { expense: 0, income: 0, internalIncome: 0 };
      existing.expense += Number(f.expense);
      existing.income += Number(f.income);
      existing.internalIncome += Number(f.internalIncome);
      byYearMonth.set(key, existing);
    }
    for (const [period, totals] of byYearMonth) {
      sections.push(`▸ ${period}: Toplam Gider ${d(totals.expense)}, Toplam Gelir ${d(totals.income)}, Toplam İç Kaynak ${d(totals.internalIncome)}`);
    }
  }

  // ── 8. EFOR ÖZET ──────────────────────────────────────────────
  if (assignments.length > 0) {
    sections.push('\n=== EFOR ATAMA ÖZETİ ===');
    const totalPlanned = assignments.reduce((s, a) => s + Number(a.plannedDays), 0);
    const totalActual = assignments.reduce((s, a) => s + Number(a.actualDays), 0);
    sections.push(`Toplam Planlanan Efor: ${d(totalPlanned)} adam-gün`);
    sections.push(`Toplam Gerçekleşen Efor: ${d(totalActual)} adam-gün`);
    sections.push(`Toplam Atama Sayısı: ${assignments.length}`);
  }

  return sections.join('\n');
}

// ── Ana API Handler ─────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Veritabanındaki TÜM veriyi çek ve formatla
    const dbContext = await buildFullDatabaseContext();

    const systemPrompt = `Sen "Endüstri 4.0 Yönetim Portalı"nın veritabanı asistanısın. Adın "Gemma Asistan".

## GÖREVİN
Kullanıcıların veritabanındaki verilerle ilgili sorularını yanıtlıyorsun. Aşağıda sana sunulan veritabanı dökümündeki TÜM bilgilere hakimsin.

## VERİTABANI ŞEMASI VE İLİŞKİLER
Sistem şu tablolardan oluşur:
- **Proje (Project):** Endüstri 4.0 projeleri. Her projenin kodu, adı, durumu, riski, önceliği, bütçesi, başlangıç/bitiş tarihi var.
- **Fabrika (Factory):** Projelerin yürütüldüğü fabrikalar. Bir proje birden fazla fabrikada olabilir (çoka-çok ilişki).
- **Takım Üyesi (TeamMember):** Projelere atanan ekip üyeleri.
- **Efor Ataması (Assignment):** Takım üyelerinin projelere aylık adam-gün bazında plan ve gerçekleşen efor atamaları.
- **Bütçe Kalemi (BudgetItem):** Projelerin detaylı bütçe kalemleri (donanım, yazılım, işçilik vb.). amount = quantity × unitPrice.
- **Aylık Finansal (MonthlyFinancial):** Projelerin aylık gelir/gider/iç kaynak geliri. Gelir her zaman giderin %5 fazlasıdır.
- **Fatura (Invoice):** Projelere ait fatura kayıtları. Statü: Kesilecek veya Kesildi. Kesilecek faturalar planlanan tarihe göre ayrıca "Yaklaşıyor" (tarihe 7 gün veya daha az kaldıysa) ya da "Gecikti" (tarih geçtiyse) olarak etiketlenir.
- **Uygulama (Application):** Lisanslanan yazılımlar (örn. Ignition, AutoCAD).
- **Lisans (License):** Uygulamaların lisans kayıtları. Abonelik veya tek seferlik olabilir. Fabrikalara atanabilir.
- **Kullanıcı (User):** Sisteme giriş yapan kullanıcılar. Admin veya normal kullanıcı olabilir.
- **Proje Logu (ProjectLog):** Projelerdeki değişikliklerin tarihsel kaydı.

## KURALLAR
1. SADECE aşağıdaki veritabanı dökümündeki bilgilere göre cevap ver.
2. Eğer soru veritabanı dökümünde yoksa, nazikçe "Bu bilgi veritabanımda bulunmuyor" de.
3. Sayısal sorularda (toplam bütçe, efor, fatura tutarı vb.) hesaplama yap ve net rakam ver.
4. Tarih sorularında Türkçe tarih formatı kullan.
5. Para birimi bilgisini her zaman belirt (TRY, USD, EUR, GBP).
6. Yanıtlarını Türkçe ver.
7. Listelemelerde düzenli ve okunabilir format kullan.
8. Genel kültür, dünya bilgisi gibi veritabanı dışı sorulara "Sadece Endüstri 4.0 portal veritabanındaki verilerle ilgili yanıt verebilirim" de.

## VERİTABANI DÖKÜMÜ
${dbContext}
`;

    // Son kullanıcı mesajına hatırlatma ekle (küçük modeller system prompt'u unutabiliyor)
    const modifiedMessages = [...messages];
    const lastUserIdx = modifiedMessages.findLastIndex((m: any) => m.role === 'user');
    if (lastUserIdx !== -1) {
      modifiedMessages[lastUserIdx] = {
        ...modifiedMessages[lastUserIdx],
        content: `${modifiedMessages[lastUserIdx].content}

[KESİN TALİMAT: Yanıtını SADECE yukarıdaki veritabanı dökümünden oluştur. Veritabanında olmayan bilgiye yanıt verme.]`,
      };
    }

    const messagesWithContext = [
      { role: 'system', content: systemPrompt },
      ...modifiedMessages,
    ];

    console.log(`[Chat API] DB context size: ${dbContext.length} chars, System prompt total: ${systemPrompt.length} chars`);

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma2:2b',
        messages: messagesWithContext,
        stream: false,
        options: {
          num_ctx: 8192,       // Context window — gemma2:2b 8K'ya kadar destekler
          temperature: 0.3,    // Daha tutarlı yanıtlar için düşük sıcaklık
          top_p: 0.9,
        },
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
