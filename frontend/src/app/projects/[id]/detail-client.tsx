"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  History,
  Users,
  ListTree,
  CalendarDays,
  Receipt,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ProjectForm } from "../project-form";
import {
  upsertAssignment,
  deleteAssignment,
} from "@/app/actions/projects";
import {
  addBudgetItem,
  deleteBudgetItem,
  upsertMonthlyFinancial,
  addInvoice,
  updateInvoiceStatus,
  deleteInvoice,
} from "@/app/actions/finance";
import type {
  AssignmentDTO,
  BudgetItemDTO,
  FactoryDTO,
  FinancialDTO,
  InvoiceDTO,
  LogDTO,
  MemberDTO,
  ProjectDTO,
  RatesDTO,
} from "@/lib/types";
import {
  cn,
  CURRENCIES,
  CURRENCY_LABELS,
  CurrencyCode,
  formatDate,
  formatMoney,
  INCOME_MARKUP,
  INVOICE_STATUS_LABELS,
  MONTHS_TR,
  RISK_LABELS,
  STATUS_LABELS,
} from "@/lib/utils";

function CurrencySelect({
  name,
  defaultValue = "TRY",
}: {
  name: string;
  defaultValue?: string;
}) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {CURRENCY_LABELS[c]}
        </option>
      ))}
    </Select>
  );
}

type Tab = "team" | "budget" | "monthly" | "invoices" | "history";

const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "team", label: "Ekip & Efor", icon: Users },
  { id: "budget", label: "Bütçe Kırılımı", icon: ListTree },
  { id: "monthly", label: "Aylık Finans", icon: CalendarDays },
  { id: "invoices", label: "Faturalar", icon: Receipt },
  { id: "history", label: "Değişiklik Geçmişi", icon: History },
];

export function ProjectDetailClient(props: {
  project: ProjectDTO;
  logs: LogDTO[];
  assignments: AssignmentDTO[];
  budgetItems: BudgetItemDTO[];
  financials: FinancialDTO[];
  invoices: InvoiceDTO[];
  rates: RatesDTO;
  factories: FactoryDTO[];
  members: MemberDTO[];
}) {
  const { project } = props;
  const [tab, setTab] = useState<Tab>("team");
  const [editing, setEditing] = useState(false);

  const plannedTotal = props.assignments.reduce((s, a) => s + a.plannedDays, 0);
  const actualTotal = props.assignments.reduce((s, a) => s + a.actualDays, 0);
  // Bütçe kalemleri farklı para biriminde olabilir; toplam TL karşılığı üzerinden.
  const budgetTotal = props.budgetItems.reduce((s, b) => s + b.amountTRY, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/projects"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Projeler
          </Link>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span className="font-mono text-xl text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {project.projectCode}
            </span>
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.factoryNames.join(", ")} · {formatDate(project.startDate)} →{" "}
            {formatDate(project.endDate)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={project.status === "ACTIVE" ? "success" : "info"}>
              {STATUS_LABELS[project.status]}
            </Badge>
            <Badge
              tone={
                project.riskLevel === "LOW"
                  ? "success"
                  : project.riskLevel === "MEDIUM"
                    ? "warning"
                    : "destructive"
              }
            >
              Risk: {RISK_LABELS[project.riskLevel]}
            </Badge>
            <Badge tone="info">Öncelik: {RISK_LABELS[project.priority]}</Badge>
            <Badge tone="muted">Gerçekleşme: %{project.probability}</Badge>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" /> Düzenle
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Hedef Bütçe" value={formatMoney(project.targetBudget)} />
        <StatCard label="Bütçe Kırılımı (TL karşılığı)" value={formatMoney(budgetTotal)} />
        <StatCard label="Planlanan Efor" value={`${plannedTotal.toFixed(0)} adam-gün`} />
        <StatCard
          label="Gerçekleşen Efor"
          value={`${actualTotal.toFixed(0)} adam-gün`}
          sub={
            plannedTotal > 0
              ? `Plana oran: %${Math.round((actualTotal / plannedTotal) * 100)}`
              : undefined
          }
        />
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "relative flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              tab === id ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === id && <div className="absolute inset-0 rounded-md bg-accent" />}
            <Icon className="relative z-10 h-4 w-4" />
            <span className="relative z-10">{label}</span>
          </button>
        ))}
      </div>

      <div>
        {tab === "team" && <TeamTab {...props} />}
        {tab === "budget" && <BudgetTab {...props} />}
        {tab === "monthly" && <MonthlyTab {...props} />}
        {tab === "invoices" && <InvoicesTab {...props} />}
        {tab === "history" && <HistoryTab logs={props.logs} />}
      </div>

      <Dialog open={editing} onClose={() => setEditing(false)} title="Projeyi Düzenle" wide>
        <ProjectForm
          factories={props.factories}
          project={project}
          onDone={() => setEditing(false)}
        />
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-lg font-bold">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ── Ekip & Efor ─────────────────────────────────────────

function TeamTab({
  project,
  assignments,
  members,
}: {
  project: ProjectDTO;
  assignments: AssignmentDTO[];
  members: MemberDTO[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    await upsertAssignment({
      projectId: project.id,
      memberId: String(fd.get("memberId")),
      year: Number(fd.get("year")),
      month: Number(fd.get("month")),
      plannedDays: Number(fd.get("plannedDays")),
      actualDays: Number(fd.get("actualDays")),
      resources: (fd.get("resources") as string) || null,
    });
    setLoading(false);
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Ekip Atamaları ve Aylık Efor</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Atama Ekle
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Ekip Üyesi</TH>
              <TH>Dönem</TH>
              <TH className="text-right">Plan (adam-gün)</TH>
              <TH className="text-right">Gerçekleşen</TH>
              <TH>Fark</TH>
              <TH>Kaynaklar</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {assignments.map((a) => {
              const diff = a.actualDays - a.plannedDays;
              return (
                <TR key={a.id}>
                  <TD className="font-medium">{a.memberName}</TD>
                  <TD className="text-muted-foreground">
                    {MONTHS_TR[a.month - 1]} {a.year}
                  </TD>
                  <TD className="text-right">{a.plannedDays}</TD>
                  <TD className="text-right">{a.actualDays}</TD>
                  <TD>
                    {a.actualDays === 0 ? (
                      <Badge tone="muted">Bekliyor</Badge>
                    ) : (
                      <Badge tone={diff > 0 ? "destructive" : "success"}>
                        {diff > 0 ? `+${diff}` : diff}
                      </Badge>
                    )}
                  </TD>
                  <TD className="text-muted-foreground">{a.resources ?? "—"}</TD>
                  <TD>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Sil"
                      onClick={() => deleteAssignment(a.id, project.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TD>
                </TR>
              );
            })}
            {assignments.length === 0 && (
              <TR>
                <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                  Henüz atama yok.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title="Atama Ekle / Güncelle">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Ekip Üyesi</Label>
              <Select name="memberId" required>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.title ? `— ${m.title}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Yıl</Label>
              <Input name="year" type="number" defaultValue={new Date().getFullYear()} required />
            </div>
            <div>
              <Label>Ay</Label>
              <Select name="month" defaultValue={String(new Date().getMonth() + 1)}>
                {MONTHS_TR.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Plan (adam-gün)</Label>
              <Input name="plannedDays" type="number" step="0.5" min={0} defaultValue={0} required />
            </div>
            <div>
              <Label>Gerçekleşen (adam-gün)</Label>
              <Input name="actualDays" type="number" step="0.5" min={0} defaultValue={0} required />
            </div>
            <div className="col-span-2">
              <Label>Kaynaklar</Label>
              <Input name="resources" placeholder="örn. Laptop, Ignition Dev lisansı" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Kaydet
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// ── Bütçe Kırılımı ──────────────────────────────────────

function BudgetTab({
  project,
  budgetItems,
}: {
  project: ProjectDTO;
  budgetItems: BudgetItemDTO[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const years = useMemo(
    () => Array.from(new Set(budgetItems.map((b) => b.year))).sort((a, b) => a - b),
    [budgetItems]
  );
  const [year, setYear] = useState(
    years.includes(new Date().getFullYear())
      ? new Date().getFullYear()
      : (years[years.length - 1] ?? new Date().getFullYear())
  );
  // Yalnızca seçili yılın kalemleri gösterilir; her yıl ayrı bir bütçe kırılımıdır.
  const yearItems = useMemo(() => budgetItems.filter((b) => b.year === year), [budgetItems, year]);
  // Toplam TL karşılığı üzerinden (kalemler farklı para biriminde olabilir).
  const totalTRY = yearItems.reduce((s, b) => s + b.amountTRY, 0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    await addBudgetItem({
      projectId: project.id,
      year: Number(fd.get("year")) || year,
      category: String(fd.get("category")),
      description: String(fd.get("description")),
      quantity: Number(fd.get("quantity")),
      unitPrice: Number(fd.get("unitPrice")),
      currency: fd.get("currency") as CurrencyCode,
    });
    setLoading(false);
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Teklif / Bütçe Kırılımları</CardTitle>
          <CardDescription>{year} yılı bütçe kalemleri</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>
            ← {year - 1}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)}>
            {year + 1} →
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Kalem Ekle
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Kategori</TH>
              <TH>Açıklama</TH>
              <TH className="text-right">Miktar</TH>
              <TH className="text-right">Birim Fiyat</TH>
              <TH className="text-right">Tutar</TH>
              <TH className="text-right">TL Karşılığı</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {yearItems.map((b) => (
              <TR key={b.id}>
                <TD>
                  <Badge tone="info">{b.category}</Badge>
                </TD>
                <TD>{b.description}</TD>
                <TD className="text-right">{b.quantity}</TD>
                <TD className="text-right">{formatMoney(b.unitPrice, b.currency)}</TD>
                <TD className="text-right font-medium">{formatMoney(b.amount, b.currency)}</TD>
                <TD className="text-right text-muted-foreground">
                  {b.currency === "TRY" ? "—" : formatMoney(b.amountTRY)}
                </TD>
                <TD>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Sil"
                    onClick={() => deleteBudgetItem(b.id, project.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TD>
              </TR>
            ))}
            {yearItems.length === 0 && (
              <TR>
                <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                  {year} yılı için bütçe kalemi eklenmemiş.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
        {yearItems.length > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
            <span className="font-medium">
              Toplam (TL karşılığı) — Hedef bütçenin %
              {project.targetBudget > 0
                ? Math.round((totalTRY / project.targetBudget) * 100)
                : 0}
              &apos;i
            </span>
            <span className="text-base font-bold">{formatMoney(totalTRY)}</span>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title="Bütçe Kalemi Ekle">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Yıl</Label>
              <Input name="year" type="number" min={2000} max={2100} defaultValue={year} required />
            </div>
            <div>
              <Label>Kategori</Label>
              <Input name="category" placeholder="Donanım / Yazılım / İşçilik" required />
            </div>
            <div>
              <Label>Açıklama</Label>
              <Input name="description" required />
            </div>
            <div>
              <Label>Miktar</Label>
              <Input name="quantity" type="number" step="0.01" min={0} defaultValue={1} required />
            </div>
            <div>
              <Label>Birim Fiyat</Label>
              <Input name="unitPrice" type="number" step="0.01" min={0} required />
            </div>
            <div className="col-span-2">
              <Label>Para Birimi</Label>
              <CurrencySelect name="currency" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Ekle
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// ── Aylık Finans Grid ───────────────────────────────────

function MonthlyTab({
  project,
  financials,
}: {
  project: ProjectDTO;
  financials: FinancialDTO[];
}) {
  const [year, setYear] = useState(new Date().getFullYear());

  const byMonth = useMemo(() => {
    const map = new Map<number, FinancialDTO>();
    financials.filter((f) => f.year === year).forEach((f) => map.set(f.month, f));
    return map;
  }, [financials, year]);

  // Yıllık toplamlar TL karşılığı üzerinden (aylar farklı para biriminde olabilir).
  const totals = MONTHS_TR.reduce(
    (acc, _, i) => {
      const f = byMonth.get(i + 1);
      acc.income += f?.incomeTRY ?? 0;
      acc.expense += f?.expenseTRY ?? 0;
      acc.internal += f?.internalIncomeTRY ?? 0;
      return acc;
    },
    { income: 0, expense: 0, internal: 0 }
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Aylık Gelir / Gider / İç Kaynak Geliri — {year}</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>
            ← {year - 1}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)}>
            {year + 1} →
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 rounded-lg border border-primary/20 bg-accent/50 px-4 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Gelir otomatik:</span> girdiğiniz
          giderin %5 fazlası olarak hesaplanır. Sadece gider, iç kaynak geliri ve para birimini
          girin.
        </div>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-success/10 px-4 py-3">
            <div className="text-xs font-medium text-success">Yıllık Gelir (TL)</div>
            <div className="text-lg font-bold">{formatMoney(totals.income)}</div>
          </div>
          <div className="rounded-lg bg-destructive/10 px-4 py-3">
            <div className="text-xs font-medium text-destructive">Yıllık Gider (TL)</div>
            <div className="text-lg font-bold">{formatMoney(totals.expense)}</div>
          </div>
          <div className="rounded-lg bg-accent px-4 py-3">
            <div className="text-xs font-medium text-primary">İç Kaynak Geliri (TL)</div>
            <div className="text-lg font-bold">{formatMoney(totals.internal)}</div>
          </div>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Ay</TH>
              <TH>Gider</TH>
              <TH>Gelir (otomatik +%5)</TH>
              <TH>İç Kaynak Geliri</TH>
              <TH>Para Birimi</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {MONTHS_TR.map((name, i) => (
              <MonthlyRow
                key={i + 1}
                projectId={project.id}
                year={year}
                month={i + 1}
                name={name}
                data={byMonth.get(i + 1)}
              />
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MonthlyRow({
  projectId,
  year,
  month,
  name,
  data,
}: {
  projectId: string;
  year: number;
  month: number;
  name: string;
  data?: FinancialDTO;
}) {
  const [expense, setExpense] = useState<number>(data?.expense ?? 0);
  const [saving, setSaving] = useState(false);
  const income = Math.round(expense * INCOME_MARKUP * 100) / 100;

  async function save(fd: FormData) {
    setSaving(true);
    await upsertMonthlyFinancial({
      projectId,
      year,
      month,
      expense: Number(fd.get("expense")),
      internalIncome: Number(fd.get("internalIncome")),
      currency: fd.get("currency") as CurrencyCode,
    });
    setSaving(false);
  }

  return (
    <TR>
      <TD className="font-medium">{name}</TD>
      <TD colSpan={5} className="p-0">
        <form
          className="flex items-center gap-2 px-3 py-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            save(new FormData(e.currentTarget));
          }}
        >
          <Input
            name="expense"
            type="number"
            step="0.01"
            value={expense}
            onChange={(e) => setExpense(Number(e.target.value))}
            className="h-8"
          />
          <Input
            value={income}
            readOnly
            tabIndex={-1}
            className="h-8 bg-muted text-muted-foreground"
          />
          <Input
            name="internalIncome"
            type="number"
            step="0.01"
            defaultValue={data?.internalIncome ?? 0}
            className="h-8"
          />
          <Select
            name="currency"
            defaultValue={data?.currency ?? "TRY"}
            className="h-8 w-24"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="outline" type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Kaydet"}
          </Button>
        </form>
      </TD>
    </TR>
  );
}

// ── Faturalar ───────────────────────────────────────────

function InvoicesTab({
  project,
  invoices,
}: {
  project: ProjectDTO;
  invoices: InvoiceDTO[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    await addInvoice({
      projectId: project.id,
      description: String(fd.get("description")),
      amount: Number(fd.get("amount")),
      currency: fd.get("currency") as CurrencyCode,
      issueDate: String(fd.get("issueDate")),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: fd.get("status") as any,
      ebaNumber: fd.get("ebaNumber") ? String(fd.get("ebaNumber")) : undefined,
      poNumber: fd.get("poNumber") ? String(fd.get("poNumber")) : undefined,
    });
    setLoading(false);
    setOpen(false);
  }

  const tone = (s: string) =>
    s === "PAID" ? "success" : s === "ISSUED" ? "info" : s === "OVERDUE" ? "destructive" : "muted";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Faturalama Takvimi</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Fatura Ekle
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Açıklama</TH>
              <TH>EBA No</TH>
              <TH>P.O. No</TH>
              <TH>Kesim Tarihi</TH>
              <TH className="text-right">Tutar</TH>
              <TH className="text-right">TL Karşılığı</TH>
              <TH>Durum</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {invoices.map((inv) => (
              <TR key={inv.id}>
                <TD className="font-medium">{inv.description}</TD>
                <TD>{inv.ebaNumber || "—"}</TD>
                <TD>{inv.poNumber || "—"}</TD>
                <TD className="text-muted-foreground">{formatDate(inv.issueDate)}</TD>
                <TD className="text-right font-medium">
                  {formatMoney(inv.amount, inv.currency)}
                </TD>
                <TD className="text-right text-muted-foreground">
                  {inv.currency === "TRY" ? "—" : formatMoney(inv.amountTRY)}
                </TD>
                <TD>
                  <Select
                    className="h-8 w-36"
                    defaultValue={inv.status}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onChange={(e) => updateInvoiceStatus(inv.id, e.target.value as any)}
                  >
                    {Object.entries(INVOICE_STATUS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </TD>
                <TD>
                  <div className="flex items-center gap-1">
                    <Badge tone={tone(inv.status)}>{INVOICE_STATUS_LABELS[inv.status]}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Sil"
                      onClick={() => deleteInvoice(inv.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
            {invoices.length === 0 && (
              <TR>
                <TD colSpan={8} className="py-8 text-center text-muted-foreground">
                  Fatura kaydı yok.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title="Fatura Ekle">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Açıklama</Label>
              <Input name="description" required />
            </div>
            <div>
              <Label>Tutar</Label>
              <Input name="amount" type="number" step="0.01" min={0} required />
            </div>
            <div>
              <Label>Para Birimi</Label>
              <CurrencySelect name="currency" />
            </div>
            <div>
              <Label>Kesim Tarihi</Label>
              <Input name="issueDate" type="date" required />
            </div>
            <div>
              <Label>Durum</Label>
              <Select name="status" defaultValue="PLANNED">
                {Object.entries(INVOICE_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>EBA No</Label>
              <Input name="ebaNumber" placeholder="Opsiyonel" />
            </div>
            <div>
              <Label>P.O. No</Label>
              <Input name="poNumber" placeholder="Opsiyonel" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Ekle
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// ── Değişiklik Geçmişi ──────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  name: "Proje Adı",
  projectCode: "Proje Kodu",
  factories: "Fabrika(lar)",
  probability: "Gerçekleşme İhtimali",
  targetBudget: "Hedef Bütçe",
  startDate: "Başlangıç Tarihi",
  endDate: "Bitiş Tarihi",
  riskLevel: "Risk Derecesi",
  priority: "Öncelik",
  status: "Durum",
  description: "Açıklama",
  oluşturma: "Oluşturma",
};

function HistoryTab({ logs }: { logs: LogDTO[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarihsel Değişiklik Logu</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {logs.map((l, i) => (
            <div key={l.id} className="relative flex gap-4 pb-6">
              {i < logs.length - 1 && (
                <div className="absolute top-3 left-[5px] h-full w-px bg-border" />
              )}
              <div className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0">
                <div className="text-sm">
                  <span className="font-medium">
                    {FIELD_LABELS[l.field] ?? l.field}
                  </span>{" "}
                  {l.field === "oluşturma" ? (
                    <span className="text-muted-foreground">{l.newValue}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      <span className="line-through">{l.oldValue || "—"}</span>
                      {" → "}
                      <span className="font-medium text-foreground">
                        {l.newValue || "—"}
                      </span>
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("tr-TR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(l.createdAt))}
                  {l.userName ? ` · ${l.userName}` : ""}
                </div>
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Kayıtlı değişiklik yok.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
