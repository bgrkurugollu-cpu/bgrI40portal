"use client";

import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  FolderKanban,
  Wallet,
  Users,
  KeyRound,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  CurrencyCode,
  cn,
  formatDate,
  formatMoney,
  INVOICE_STATUS_LABELS,
  MONTHS_TR,
  MONTHS_TR_SHORT,
} from "@/lib/utils";

type Stats = {
  activeProjects: number;
  totalProjects: number;
  totalBudget: number;
  teamSize: number;
  licenseCount: number;
  licenseInvestment: number;
  highRisk: number;
};

export function DashboardClient({
  year,
  stats,
  monthly,
  financialsByProject,
  effort,
  upcomingInvoices,
}: {
  year: number;
  stats: Stats;
  monthly: { month: number; income: number; expense: number; internal: number }[];
  financialsByProject: {
    projectId: string;
    projectCode: string;
    projectName: string;
    month: number;
    incomeTRY: number;
    expenseTRY: number;
    internalIncomeTRY: number;
  }[];
  effort: { month: number; planned: number; actual: number }[];
  upcomingInvoices: {
    id: string;
    projectId: string;
    projectCode: string;
    projectName: string;
    description: string;
    amount: number;
    currency: CurrencyCode;
    amountTRY: number;
    issueDate: string;
    status: string;
    ebaNumber: string | null;
    poNumber: string | null;
  }[];
}) {
  const finData = monthly.map((m) => ({
    name: MONTHS_TR_SHORT[m.month - 1],
    Gelir: m.income + m.internal,
    Gider: m.expense,
  }));
  const effortData = effort.map((e) => ({
    name: MONTHS_TR_SHORT[e.month - 1],
    Planlanan: e.planned,
    Gerçekleşen: e.actual,
  }));

  // ── Nakit akışı anomali içgörüleri: içinde bulunulan ay ±1 ──
  // İş kuralı: gelir = gider × 1.05 (markup sabit %5). Kârlılığı asıl oynatan
  // iç kaynak (internalIncome) geliridir. Marj hedefi ~%5; toleransla değerlendirilir.
  const MARGIN_TARGET = 0.05;
  const MARGIN_TOL = 0.01; // ±1 puan bandı "normal" sayılır
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const insightMonths = [currentMonth - 1, currentMonth, currentMonth + 1].filter(
    (m) => m >= 1 && m <= 12
  );

  const insights = insightMonths.map((month) => {
    const agg = monthly.find((m) => m.month === month);
    const income = agg?.income ?? 0;
    const expense = agg?.expense ?? 0;
    const internal = agg?.internal ?? 0;
    const ciro = income + internal;
    const kar = ciro - expense;
    const marj = ciro > 0 ? kar / ciro : 0;
    const hasData = ciro > 0 || expense > 0;

    let status: "low" | "high" | "normal" | "none";
    if (!hasData) status = "none";
    else if (marj < MARGIN_TARGET - MARGIN_TOL) status = "low";
    else if (marj > MARGIN_TARGET + MARGIN_TOL) status = "high";
    else status = "normal";

    const rows = financialsByProject.filter((f) => f.month === month);
    // Kök neden: düşük kârlılıkta gider payı en yüksek proje(ler);
    // yüksek kârlılıkta iç kaynağı en yüksek proje(ler).
    let causes: { code: string; name: string; detail: string }[] = [];
    if (status === "low") {
      causes = [...rows]
        .filter((r) => r.expenseTRY > 0)
        .sort((a, b) => b.expenseTRY - a.expenseTRY)
        .slice(0, 2)
        .map((r) => ({
          code: r.projectCode,
          name: r.projectName,
          detail: `gider ${formatMoney(r.expenseTRY)}`,
        }));
    } else if (status === "high") {
      causes = [...rows]
        .filter((r) => r.internalIncomeTRY > 0)
        .sort((a, b) => b.internalIncomeTRY - a.internalIncomeTRY)
        .slice(0, 2)
        .map((r) => ({
          code: r.projectCode,
          name: r.projectName,
          detail: `iç kaynak +${formatMoney(r.internalIncomeTRY)}`,
        }));
    }

    return { month, income, expense, internal, ciro, kar, marj, status, causes };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Genel Bakış</h1>
        <p className="text-sm text-muted-foreground">
          Proje, bütçe ve lisans durumunun özeti — {year}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi
          icon={FolderKanban}
          label="Aktif Proje"
          value={`${stats.activeProjects} / ${stats.totalProjects}`}
        />
        <Kpi icon={Wallet} label="Toplam Hedef Bütçe" value={formatMoney(stats.totalBudget)} />
        <Kpi icon={Users} label="Ekip" value={`${stats.teamSize} kişi`} />
        <Kpi
          icon={KeyRound}
          label="Lisans Portföyü"
          value={`${stats.licenseCount} · ${formatMoney(stats.licenseInvestment)}`}
        />
        <Kpi
          icon={AlertTriangle}
          label="Yüksek Riskli Proje"
          value={String(stats.highRisk)}
          warn={stats.highRisk > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Nakit Akışı ({year})</CardTitle>
              <CardDescription>Gelir (iç kaynak dahil) ve gider — TL karşılığı</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={finData}>
                    <defs>
                      <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--success)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      formatter={(v) => formatMoney(Number(v))}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--foreground)",
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="Gelir"
                      stroke="var(--success)"
                      fill="url(#gIncome)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="Gider"
                      stroke="var(--destructive)"
                      fill="url(#gExpense)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Ekip Eforu ({year})</CardTitle>
              <CardDescription>Planlanan vs gerçekleşen adam-gün</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={effortData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--foreground)",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Planlanan" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Gerçekleşen" fill="var(--success)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>Nakit Akışı Anomali İçgörüleri</CardTitle>
            <CardDescription>
              İçinde bulunulan ay ve komşu aylar (±1) için gelir–gider dengesi. Hedef
              kârlılık ~%5; sapmanın kök nedeni proje bazında belirtilir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {insights.map((ins) => (
                <InsightCard
                  key={ins.month}
                  ins={ins}
                  isCurrent={ins.month === currentMonth}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
          <Card>
            <CardHeader>
              <CardTitle>Yaklaşan Faturalar</CardTitle>
              <CardDescription>Planlanan ve kesilen faturalar</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>Tarih</TH>
                    <TH>Kodu</TH>
                    <TH>Proje</TH>
                    <TH>EBA No</TH>
                    <TH>P.O. No</TH>
                    <TH className="text-right">Tutar</TH>
                    <TH>Durum</TH>
                  </TR>
                </THead>
                <TBody>
                  {upcomingInvoices.map((inv) => (
                    <TR key={inv.id}>
                      <TD className="font-medium">{formatDate(inv.issueDate)}</TD>
                      <TD className="font-mono text-xs font-bold text-muted-foreground">
                        {inv.projectCode}
                      </TD>
                      <TD>
                        <Link
                          href={`/projects/${inv.projectId}`}
                          className="text-primary hover:underline"
                        >
                          {inv.projectName}
                        </Link>
                        <div className="text-xs text-muted-foreground">{inv.description}</div>
                      </TD>
                      <TD>{inv.ebaNumber || "—"}</TD>
                      <TD>{inv.poNumber || "—"}</TD>
                      <TD className="text-right font-medium">
                        {formatMoney(inv.amount, inv.currency)}
                        {inv.currency !== "TRY" && (
                          <div className="text-xs font-normal text-muted-foreground">
                            ≈ {formatMoney(inv.amountTRY)}
                          </div>
                        )}
                      </TD>
                      <TD>
                        <Badge tone={inv.status === "ISSUED" ? "info" : "muted"}>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                  {upcomingInvoices.length === 0 && (
                    <TR>
                      <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                        Yaklaşan fatura yok.
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            warn ? "bg-destructive/10 text-destructive" : "bg-accent text-primary"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="truncate text-base font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

type Insight = {
  month: number;
  income: number;
  expense: number;
  internal: number;
  ciro: number;
  kar: number;
  marj: number;
  status: "low" | "high" | "normal" | "none";
  causes: { code: string; name: string; detail: string }[];
};

function InsightCard({ ins, isCurrent }: { ins: Insight; isCurrent: boolean }) {
  const meta = {
    low: { tone: "bg-destructive/10 text-destructive", icon: TrendingDown, label: "Düşük kârlılık" },
    high: { tone: "bg-success/10 text-success", icon: TrendingUp, label: "Yüksek kârlılık" },
    normal: { tone: "bg-muted text-muted-foreground", icon: Minus, label: "Normal (~%5)" },
    none: { tone: "bg-muted text-muted-foreground", icon: Minus, label: "Veri yok" },
  }[ins.status];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        isCurrent && "ring-2 ring-primary/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">
          {MONTHS_TR[ins.month - 1]}
          {isCurrent && <span className="ml-1 text-xs font-normal text-primary">(bu ay)</span>}
        </div>
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            meta.tone
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </span>
      </div>

      {ins.status === "none" ? (
        <p className="mt-2 text-sm text-muted-foreground">Bu ay için finansal veri yok.</p>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums">
              %{(ins.marj * 100).toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">kârlılık marjı</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Ciro {formatMoney(ins.ciro)} · Gider {formatMoney(ins.expense)} · Kâr{" "}
            {formatMoney(ins.kar)}
          </div>
          {ins.causes.length > 0 ? (
            <div className="mt-3 border-t pt-2">
              <div className="text-xs font-medium text-muted-foreground">Kök neden</div>
              <ul className="mt-1 space-y-0.5">
                {ins.causes.map((c) => (
                  <li key={c.code} className="text-xs" title={c.name}>
                    <span className="font-mono font-semibold">{c.code}</span> — {c.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            ins.status !== "normal" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Belirgin proje kırılımı bulunamadı.
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}
