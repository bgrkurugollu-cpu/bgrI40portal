"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  CurrencyCode,
  formatDate,
  formatMoney,
  INVOICE_STATUS_LABELS,
  MONTHS_TR_SHORT,
  RISK_LABELS,
  STATUS_LABELS,
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
  effort,
  upcomingInvoices,
  projects,
}: {
  year: number;
  stats: Stats;
  monthly: { month: number; income: number; expense: number; internal: number }[];
  effort: { month: number; planned: number; actual: number }[];
  upcomingInvoices: {
    id: string;
    projectId: string;
    projectName: string;
    description: string;
    amount: number;
    currency: CurrencyCode;
    amountTRY: number;
    issueDate: string;
    status: string;
  }[];
  projects: {
    id: string;
    name: string;
    factoryName: string;
    status: string;
    riskLevel: string;
    probability: number;
    targetBudget: number;
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

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold">Genel Bakış</h1>
        <p className="text-sm text-muted-foreground">
          Proje, bütçe ve lisans durumunun özeti — {year}
        </p>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 gap-4 lg:grid-cols-5">
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
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={item}>
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
        </motion.div>

        <motion.div variants={item}>
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
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>Projeler</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>Kodu</TH>
                    <TH>Proje</TH>
                    <TH>Fabrika</TH>
                    <TH>Risk</TH>
                    <TH>Durum</TH>
                    <TH className="text-right">Bütçe</TH>
                  </TR>
                </THead>
                <TBody>
                  {projects.map((p) => (
                    <TR key={p.id}>
                      <TD className="font-mono text-xs font-bold text-muted-foreground">
                        {p.projectCode}
                      </TD>
                      <TD>
                        <Link
                          href={`/projects/${p.id}`}
                          className="group inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          {p.name}
                          <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                      </TD>
                      <TD className="text-muted-foreground">{p.factoryName}</TD>
                      <TD>
                        <Badge
                          tone={
                            p.riskLevel === "LOW"
                              ? "success"
                              : p.riskLevel === "MEDIUM"
                                ? "warning"
                                : "destructive"
                          }
                        >
                          {RISK_LABELS[p.riskLevel]}
                        </Badge>
                      </TD>
                      <TD>
                        <Badge tone={p.status === "ACTIVE" ? "success" : "muted"}>
                          {STATUS_LABELS[p.status]}
                        </Badge>
                      </TD>
                      <TD className="text-right font-medium">{formatMoney(p.targetBudget)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
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
                      <TD colSpan={4} className="py-8 text-center text-muted-foreground">
                        Yaklaşan fatura yok.
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
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
