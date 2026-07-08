"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, Receipt, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import type { FinancialDTO, InvoiceDTO, RatesDTO } from "@/lib/types";
import {
  formatDate,
  formatMoney,
  INVOICE_STATUS_LABELS,
  MONTHS_TR_SHORT,
} from "@/lib/utils";

type FinRow = FinancialDTO & { projectName: string };

export function FinanceClient({
  financials,
  invoices,
  projects,
  rates,
}: {
  financials: FinRow[];
  invoices: InvoiceDTO[];
  projects: { id: string; name: string }[];
  rates: RatesDTO;
}) {
  const years = useMemo(
    () => Array.from(new Set(financials.map((f) => f.year))).sort((a, b) => a - b),
    [financials]
  );
  const [year, setYear] = useState(
    years.includes(new Date().getFullYear())
      ? new Date().getFullYear()
      : (years[0] ?? new Date().getFullYear())
  );
  const [projectFilter, setProjectFilter] = useState("all");

  const filtered = useMemo(
    () =>
      financials.filter(
        (f) => f.year === year && (projectFilter === "all" || f.projectId === projectFilter)
      ),
    [financials, year, projectFilter]
  );

  // Tüm toplamlar TL'ye çevrilerek hesaplanır (kalemler farklı para biriminde olabilir).
  const totals = filtered.reduce(
    (acc, f) => {
      acc.income += f.incomeTRY;
      acc.expense += f.expenseTRY;
      acc.internal += f.internalIncomeTRY;
      return acc;
    },
    { income: 0, expense: 0, internal: 0 }
  );
  const ciro = totals.income + totals.internal;
  const karlilik = ciro - totals.expense;

  const chartData = useMemo(
    () =>
      MONTHS_TR_SHORT.map((name, i) => {
        const rows = filtered.filter((f) => f.month === i + 1);
        const income = rows.reduce((s, f) => s + f.incomeTRY, 0);
        const expense = rows.reduce((s, f) => s + f.expenseTRY, 0);
        const internal = rows.reduce((s, f) => s + f.internalIncomeTRY, 0);
        return {
          name,
          Gelir: Math.round(income),
          Gider: Math.round(expense),
          "İç Kaynak": Math.round(internal),
          Ciro: Math.round(income + internal),
          Karlılık: Math.round(income + internal - expense),
        };
      }),
    [filtered]
  );

  const pivot = useMemo(() => {
    const byProject = new Map<string, { code?: string; name: string; months: FinRow[] }>();
    filtered.forEach((f) => {
      if (!byProject.has(f.projectId))
        byProject.set(f.projectId, { code: f.projectCode, name: f.projectName, months: [] });
      byProject.get(f.projectId)!.months.push(f);
    });
    return byProject;
  }, [filtered]);

  const filteredInvoices = useMemo(
    () =>
      invoices.filter(
        (i) =>
          new Date(i.issueDate).getFullYear() === year &&
          (projectFilter === "all" || i.projectId === projectFilter)
      ),
    [invoices, year, projectFilter]
  );

  const tone = (s: string) =>
    s === "PAID" ? "success" : s === "ISSUED" ? "info" : s === "OVERDUE" ? "destructive" : "muted";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bütçe & Finans</h1>
          <p className="text-sm text-muted-foreground">
            Gelir-gider akışı ve faturalama takvimi — {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            className="w-48"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="all">Tüm Projeler</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>
            ← {year - 1}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)}>
            {year + 1} →
          </Button>
        </div>
      </div>

      <RatesBanner rates={rates} />

      <div className="rounded-lg border border-primary/20 bg-accent/50 px-4 py-2.5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Kural:</span> Gelir, ilgili aydaki
        giderin %5 fazlası olarak otomatik hesaplanır. Tüm toplamlar güncel TCMB satış kuru
        ile TL&apos;ye çevrilerek gösterilir.
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard icon={TrendingUp} label="Toplam Gelir (TL)" value={formatMoney(totals.income)} tone="success" />
        <KpiCard icon={TrendingDown} label="Toplam Gider (TL)" value={formatMoney(totals.expense)} tone="destructive" />
        <KpiCard icon={Wallet} label="İç Kaynak Geliri (TL)" value={formatMoney(totals.internal)} tone="info" />
        <KpiCard
          icon={Receipt}
          label="Ciro (TL)"
          value={formatMoney(ciro)}
          tone="success"
        />
        <KpiCard
          icon={TrendingUp}
          label="Karlılık (TL)"
          value={formatMoney(karlilik)}
          tone={karlilik >= 0 ? "success" : "destructive"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aylık Nakit Akışı (TL karşılığı)</CardTitle>
          <CardDescription>Gelir, gider, iç kaynak geliri ve net akış</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  tickFormatter={(v) =>
                    new Intl.NumberFormat("tr-TR", {
                      notation: "compact",
                      compactDisplay: "short",
                      maximumFractionDigits: 1,
                    }).format(v) + " ₺"
                  }
                  width={90}
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
                <Bar dataKey="Gelir" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gider" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="İç Kaynak" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="Ciro" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Karlılık" stroke="var(--foreground)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proje Bazlı Aylık Grid (TL karşılığı)</CardTitle>
          <CardDescription>
            Her proje için gelir / gider / iç kaynak geliri satırları. Düzenlemek için proje
            detayına gidin.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[1200px]">
            <THead>
              <TR>
                <TH className="w-[100px]">Proje Kodu</TH>
                <TH className="w-[140px] max-w-[160px]">Proje İsmi</TH>
                <TH className="w-[80px]">Kalem</TH>
                {MONTHS_TR_SHORT.map((m) => (
                  <TH key={m} className="text-right min-w-[90px]">
                    {m}
                  </TH>
                ))}
                <TH className="text-right min-w-[110px]">Toplam</TH>
              </TR>
            </THead>
            <TBody>
              {Array.from(pivot.entries()).flatMap(([pid, { code, name, months }]) => {
                const rowFor = (
                  key: "incomeTRY" | "expenseTRY" | "internalIncomeTRY",
                  label: string
                ) => {
                  const vals = Array(12).fill(0);
                  months.forEach((m) => (vals[m.month - 1] = m[key]));
                  const total = vals.reduce((s, v) => s + v, 0);
                  return (
                    <TR key={`${pid}-${key}`}>
                      {key === "incomeTRY" && (
                        <>
                          <TD rowSpan={3} className="align-top font-mono text-xs font-bold text-muted-foreground w-[100px] truncate">
                            {code}
                          </TD>
                          <TD rowSpan={3} className="align-top font-medium w-[140px] max-w-[160px] truncate" title={name}>
                            <Link href={`/projects/${pid}`} className="text-primary hover:underline">
                              {name}
                            </Link>
                          </TD>
                        </>
                      )}
                      <TD className="text-muted-foreground">{label}</TD>
                      {vals.map((v, i) => (
                        <TD key={i} className="text-right tabular-nums text-xs whitespace-nowrap">
                          {v > 0 ? formatMoney(v) : "·"}
                        </TD>
                      ))}
                      <TD className="text-right text-xs font-semibold tabular-nums whitespace-nowrap">
                        {formatMoney(total)}
                      </TD>
                    </TR>
                  );
                };
                return [
                  rowFor("incomeTRY", "Gelir"),
                  rowFor("expenseTRY", "Gider"),
                  rowFor("internalIncomeTRY", "İç Kaynak"),
                ];
              })}
              {pivot.size === 0 && (
                <TR>
                  <TD colSpan={15} className="py-8 text-center text-muted-foreground">
                    Bu yıl için finansal kayıt yok.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Faturalama Takvimi</CardTitle>
          <CardDescription>Hangi projenin faturası ne zaman kesilecek</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Tarih</TH>
                <TH>Proje Kodu</TH>
                <TH>Proje İsmi</TH>
                <TH>Açıklama</TH>
                <TH>EBA No</TH>
                <TH>P.O. No</TH>
                <TH className="text-right">Tutar</TH>
                <TH className="text-right">TL Karşılığı</TH>
                <TH>Durum</TH>
              </TR>
            </THead>
            <TBody>
              {filteredInvoices.map((inv) => (
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
                  </TD>
                  <TD className="text-muted-foreground">{inv.description}</TD>
                  <TD>{inv.ebaNumber || "—"}</TD>
                  <TD>{inv.poNumber || "—"}</TD>
                  <TD className="text-right font-medium">
                    {formatMoney(inv.amount, inv.currency)}
                  </TD>
                  <TD className="text-right text-muted-foreground">
                    {inv.currency === "TRY" ? "—" : formatMoney(inv.amountTRY)}
                  </TD>
                  <TD>
                    <Badge tone={tone(inv.status)}>{INVOICE_STATUS_LABELS[inv.status]}</Badge>
                  </TD>
                </TR>
              ))}
              {filteredInvoices.length === 0 && (
                <TR>
                  <TD colSpan={9} className="py-8 text-center text-muted-foreground">
                    Bu yıl için fatura kaydı yok.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proje Bazlı Ciro ve Karlılık (TL karşılığı)</CardTitle>
          <CardDescription>
            Her proje için toplam gelir, gider, iç kaynak, ciro ve karlılık özeti
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Proje Kodu</TH>
                <TH>Proje İsmi</TH>
                <TH className="text-right">Toplam Gelir</TH>
                <TH className="text-right">Toplam Gider</TH>
                <TH className="text-right">İç Kaynak</TH>
                <TH className="text-right text-primary">Ciro</TH>
                <TH className="text-right font-bold">Karlılık</TH>
              </TR>
            </THead>
            <TBody>
              {Array.from(pivot.entries()).map(([pid, { code, name, months }]) => {
                const income = months.reduce((s, m) => s + m.incomeTRY, 0);
                const expense = months.reduce((s, m) => s + m.expenseTRY, 0);
                const internal = months.reduce((s, m) => s + m.internalIncomeTRY, 0);
                const pCiro = income + internal;
                const pKarlilik = pCiro - expense;

                return (
                  <TR key={pid}>
                    <TD className="font-mono text-xs font-bold text-muted-foreground">{code}</TD>
                    <TD>
                      <Link href={`/projects/${pid}`} className="text-primary hover:underline">
                        {name}
                      </Link>
                    </TD>
                    <TD className="text-right">{formatMoney(income)}</TD>
                    <TD className="text-right">{formatMoney(expense)}</TD>
                    <TD className="text-right">{formatMoney(internal)}</TD>
                    <TD className="text-right font-semibold text-primary">{formatMoney(pCiro)}</TD>
                    <TD className="text-right font-bold">
                      <Badge tone={pKarlilik >= 0 ? "success" : "destructive"}>
                        {formatMoney(pKarlilik)}
                      </Badge>
                    </TD>
                  </TR>
                );
              })}
              {pivot.size === 0 && (
                <TR>
                  <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                    Bu yıl için finansal kayıt yok.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function RatesBanner({ rates }: { rates: RatesDTO }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card px-4 py-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <RefreshCcw className="h-4 w-4 text-primary" />
        TCMB Döviz Kurları
        <span className="text-xs font-normal text-muted-foreground">
          {rates.source === "TCMB"
            ? `(${rates.date}${rates.time ? ` ${rates.time}` : ""})`
            : "(yedek kur — TCMB'ye ulaşılamadı)"}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
        <span>
          <span className="text-muted-foreground">$ USD</span>{" "}
          <span className="font-semibold">{rates.USD.toFixed(2)} ₺</span>
        </span>
        <span>
          <span className="text-muted-foreground">€ EUR</span>{" "}
          <span className="font-semibold">{rates.EUR.toFixed(2)} ₺</span>
        </span>
        <span>
          <span className="text-muted-foreground">£ GBP</span>{" "}
          <span className="font-semibold">{rates.GBP.toFixed(2)} ₺</span>
        </span>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  tone: "success" | "destructive" | "info";
}) {
  const colors = {
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    info: "bg-accent text-primary",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="text-lg font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
