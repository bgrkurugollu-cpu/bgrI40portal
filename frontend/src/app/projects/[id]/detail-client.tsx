"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
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
  Upload,
  Download,
  CalendarRange,
  Check,
  ExternalLink,
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
import { ProjectPlanTab } from "./plan-tab";
import {
  upsertAssignment,
  deleteAssignment,
  toggleAssignmentRealized,
} from "@/app/actions/projects";
import {
  addBudgetItem,
  deleteBudgetItem,
  importBudgetItemsForProject,
  upsertInternalIncome,
  addInvoice,
  updateInvoice,
  updateInvoiceStatus,
  deleteInvoice,
} from "@/app/actions/finance";
import {
  parseBudgetExcelFile,
  exportBudgetItemsToExcel,
  downloadBudgetTemplate,
  type ImportedBudgetItem,
  type BudgetExpenseType,
} from "@/lib/budget-import";
import type {
  AssignmentDTO,
  BudgetItemDTO,
  FactoryDTO,
  FinancialDTO,
  InvoiceDTO,
  LogDTO,
  MemberDTO,
  ProjectDTO,
  ProjectTaskDTO,
  RatesDTO,
} from "@/lib/types";
import {
  cn,
  CURRENCIES,
  CURRENCY_LABELS,
  CurrencyCode,
  formatDate,
  formatMoney,
  getInvoiceDerivedStatus,
  INCOME_MARKUP,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  MONTHS_TR,
  MONTHS_TR_SHORT,
  RISK_LABELS,
  STATUS_LABELS,
} from "@/lib/utils";

function CurrencySelect({
  name,
  defaultValue = "TRY",
  value,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
}) {
  const controlledProps =
    value !== undefined ? { value, onChange } : { defaultValue };
  return (
    <Select name={name} {...controlledProps}>
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {CURRENCY_LABELS[c]}
        </option>
      ))}
    </Select>
  );
}

type Tab = "team" | "budget" | "monthly" | "invoices" | "plan" | "history";

const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "team", label: "Ekip & Efor", icon: Users },
  { id: "budget", label: "Bütçe Kırılımı", icon: ListTree },
  { id: "monthly", label: "Aylık Finans", icon: CalendarDays },
  { id: "invoices", label: "Faturalar", icon: Receipt },
  { id: "plan", label: "Proje Planı", icon: CalendarRange },
  { id: "history", label: "Değişiklik Geçmişi", icon: History },
];

export function ProjectDetailClient(props: {
  project: ProjectDTO;
  logs: LogDTO[];
  assignments: AssignmentDTO[];
  budgetItems: BudgetItemDTO[];
  financials: FinancialDTO[];
  invoices: InvoiceDTO[];
  tasks: ProjectTaskDTO[];
  rates: RatesDTO;
  factories: FactoryDTO[];
  members: MemberDTO[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
}) {
  const { project } = props;
  const [tab, setTab] = useState<Tab>("team");
  const [editing, setEditing] = useState(false);

  const plannedTotal = props.assignments.reduce((s, a) => s + a.plannedDays, 0);
  const actualTotal = props.assignments.reduce((s, a) => s + a.actualDays, 0);
  // Bütçe kalemleri farklı para biriminde olabilir; toplam TL karşılığı üzerinden.
  const budgetTotal = props.budgetItems.reduce((s, b) => s + b.amountTRY, 0);
  // Proje cirosu: projenin tüm yıllarındaki aylık gelir + iç kaynak geliri toplamı.
  const ciro = props.financials.reduce((s, f) => s + f.incomeTRY + f.internalIncomeTRY, 0);
  // Karlılık: (İç Kaynak Geliri + gider × %5) / Toplam Gelir — PT'deki "gider + %5 gelir
  // kuralı" ile aynı mantık, projenin gerçek gelirine oranlanır.
  const financeTotals = props.financials.reduce(
    (acc, f) => ({
      income: acc.income + f.incomeTRY,
      expense: acc.expense + f.expenseTRY,
      internal: acc.internal + f.internalIncomeTRY,
    }),
    { income: 0, expense: 0, internal: 0 }
  );
  const profitability =
    financeTotals.income > 0
      ? (financeTotals.internal + financeTotals.expense * (INCOME_MARKUP - 1)) / financeTotals.income
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={project.kind === "PROJECT" ? "/projects" : "/lead-cr"}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {project.kind === "PROJECT" ? "Projeler" : "Lead / CR"}
          </Link>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {project.kind !== "PROJECT" && (
              <Badge tone={project.kind === "CR" ? "warning" : "info"}>{project.kind}</Badge>
            )}
            <span className="font-mono text-xl text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {project.projectCode}
            </span>
            {project.pipelineCode && (
              <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                PTM: {project.pipelineCode}
              </span>
            )}
            {project.name}
          </h1>
          {project.jiraLink && (
            <a
              href={project.jiraLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              JIRA&apos;da Görüntüle
            </a>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {project.factoryNames.join(", ")} · {formatDate(project.startDate)} →{" "}
            {formatDate(project.endDate)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={project.status === "ACTIVE" ? "success" : "info"}>
              {STATUS_LABELS[project.status]}
            </Badge>
            {project.kind === "PROJECT" && (
              <>
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
              </>
            )}
            <Badge tone="muted">Gerçekleşme: %{project.probability}</Badge>
          </div>
          {project.paymentPlanNote && (
            <div className="mt-3 max-w-2xl rounded-lg border bg-accent/30 px-3 py-2 text-sm">
              <span className="font-medium text-foreground">Ödeme Planı: </span>
              <span className="text-muted-foreground whitespace-pre-line">
                {project.paymentPlanNote}
              </span>
            </div>
          )}
        </div>
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" /> Düzenle
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <StatCard label="Hedef Bütçe" value={formatMoney(project.targetBudget)} />
        <StatCard label="Proje Cirosu" value={formatMoney(ciro)} />
        <StatCard label="Bütçe Kırılımı (TL karşılığı)" value={formatMoney(budgetTotal)} />
        <StatCard
          label="Karlılık"
          value={`%${Math.round(profitability * 100)}`}
          sub="(İç Kaynak + Gider×%5) / Gelir"
        />
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
        {tab === "plan" && (
          <ProjectPlanTab
            project={project}
            tasks={props.tasks}
            members={props.members}
            isSuperAdmin={props.isSuperAdmin}
          />
        )}
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
  isAdmin,
}: {
  project: ProjectDTO;
  assignments: AssignmentDTO[];
  members: MemberDTO[];
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(() => {
    const years = assignments.map((a) => a.year);
    return years.length ? Math.max(...years) : new Date().getFullYear();
  });

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

  // Kişi × Ay matrisi: satırlar ekip üyesi, sütunlar ay — bir bakışta efor dağılımı.
  const yearAssignments = useMemo(
    () => assignments.filter((a) => a.year === year),
    [assignments, year]
  );
  const memberRows = useMemo(() => {
    const byMember = new Map<string, { memberId: string; memberName: string; months: Map<number, AssignmentDTO> }>();
    for (const a of yearAssignments) {
      if (!byMember.has(a.memberId)) {
        byMember.set(a.memberId, { memberId: a.memberId, memberName: a.memberName, months: new Map() });
      }
      byMember.get(a.memberId)!.months.set(a.month, a);
    }
    return [...byMember.values()].sort((x, y) => x.memberName.localeCompare(y.memberName, "tr"));
  }, [yearAssignments]);
  const monthTotals = useMemo(() => {
    const totals = new Array(12).fill(0);
    for (const a of yearAssignments) totals[a.month - 1] += a.plannedDays;
    return totals;
  }, [yearAssignments]);

  async function onDeleteCell(a: AssignmentDTO) {
    if (!window.confirm(`${a.memberName} — ${MONTHS_TR[a.month - 1]} ${a.year} atamasını silmek istediğinize emin misiniz?`))
      return;
    await deleteAssignment(a.id, project.id);
  }

  async function onToggleRealized(a: AssignmentDTO) {
    await toggleAssignmentRealized(a.id, project.id);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Ekip Atamaları ve Aylık Efor</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>
            ← {year - 1}
          </Button>
          <span className="px-1 text-sm font-semibold">{year}</span>
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)}>
            {year + 1} →
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Atama Ekle
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Her hücre, o kişinin o aydaki planlanan adam-gün eforunu gösterir. Planlanan rakama
          tıklayarak eforu <span className="font-medium text-foreground">gerçekleşti</span> olarak
          işaretleyebilirsiniz (tekrar tıklarsanız geri alınır).
          {isAdmin && " Efor ekleme/silme yalnızca admin tarafından yapılabilir."}
        </p>
        <Table>
          <THead>
            <TR>
              <TH>Ekip Üyesi</TH>
              {MONTHS_TR.map((m) => (
                <TH key={m} className="text-right">
                  {m}
                </TH>
              ))}
              <TH className="text-right">Toplam</TH>
            </TR>
          </THead>
          <TBody>
            {memberRows.map((row) => {
              const rowTotal = [...row.months.values()].reduce((s, a) => s + a.plannedDays, 0);
              return (
                <TR key={row.memberId}>
                  <TD className="font-medium">{row.memberName}</TD>
                  {MONTHS_TR.map((_, i) => {
                    const a = row.months.get(i + 1);
                    if (!a) return <TD key={i} className="text-right text-muted-foreground">—</TD>;
                    const diff = a.actualDays - a.plannedDays;
                    const realized = a.plannedDays > 0 && a.actualDays === a.plannedDays;
                    return (
                      <TD key={i} className="group/cell text-right">
                        <div className="flex items-center justify-end gap-1">
                          <div>
                            <button
                              onClick={() => onToggleRealized(a)}
                              title={realized ? "Gerçekleşti — geri almak için tıklayın" : "Gerçekleşti olarak işaretle"}
                              className={cn(
                                "inline-flex items-center gap-1 rounded px-1 font-medium transition-colors hover:bg-accent",
                                realized ? "text-success" : "text-foreground"
                              )}
                            >
                              {realized && <Check className="h-3 w-3" />}
                              {a.plannedDays}
                            </button>
                            {a.actualDays > 0 && a.actualDays !== a.plannedDays && (
                              <div className={cn("text-[10px]", diff > 0 ? "text-destructive" : "text-success")}>
                                gerç: {a.actualDays}
                              </div>
                            )}
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => onDeleteCell(a)}
                              aria-label="Sil"
                              className="hidden text-muted-foreground hover:text-destructive group-hover/cell:inline-flex"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </TD>
                    );
                  })}
                  <TD className="text-right font-semibold">{rowTotal}</TD>
                </TR>
              );
            })}
            {memberRows.length === 0 && (
              <TR>
                <TD colSpan={14} className="py-8 text-center text-muted-foreground">
                  {year} yılı için henüz atama yok.
                </TD>
              </TR>
            )}
          </TBody>
          {memberRows.length > 0 && (
            <tfoot>
              <TR className="font-semibold">
                <TD>Toplam</TD>
                {monthTotals.map((t, i) => (
                  <TD key={i} className="text-right">
                    {t || "—"}
                  </TD>
                ))}
                <TD className="text-right">{monthTotals.reduce((s, t) => s + t, 0)}</TD>
              </TR>
            </tfoot>
          )}
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
  isSuperAdmin,
}: {
  project: ProjectDTO;
  budgetItems: BudgetItemDTO[];
  isSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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
  // CAPEX/OPEX toplamları, para birimi çevrilmeden, para birimi bazında ayrı ayrı.
  const typeCurrencyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of yearItems) {
      const key = `${b.expenseType}|${b.currency}`;
      map.set(key, (map.get(key) ?? 0) + b.amount);
    }
    return Array.from(map.entries())
      .map(([key, amount]) => {
        const [expenseType, currency] = key.split("|") as [BudgetExpenseType, CurrencyCode];
        return { expenseType, currency, amount };
      })
      .sort((a, b) =>
        a.expenseType === b.expenseType
          ? a.currency.localeCompare(b.currency)
          : a.expenseType.localeCompare(b.expenseType)
      );
  }, [yearItems]);

  // Form önizlemesi: Toplam Maliyet = Miktar × Birim Fiyat; TF Fiyatı = Toplam Maliyet × (1 + TF%/100).
  const [formQuantity, setFormQuantity] = useState(1);
  const [formUnitPrice, setFormUnitPrice] = useState(0);
  const [formTransferFeePercent, setFormTransferFeePercent] = useState(0);
  const [formCurrency, setFormCurrency] = useState<CurrencyCode>("TRY");
  const formAmount = formQuantity * formUnitPrice;
  const formTransferPrice = formAmount * (1 + formTransferFeePercent / 100);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    await addBudgetItem({
      projectId: project.id,
      year: Number(fd.get("year")) || year,
      expenseType: (fd.get("expenseType") as BudgetExpenseType) || "CAPEX",
      category: String(fd.get("category")),
      description: String(fd.get("description")),
      supplier: (fd.get("supplier") as string) || undefined,
      unit: (fd.get("unit") as string) || undefined,
      quantity: Number(fd.get("quantity")),
      unitPrice: Number(fd.get("unitPrice")),
      currency: fd.get("currency") as CurrencyCode,
      note: (fd.get("note") as string) || undefined,
      transferFeePercent: fd.get("transferFeePercent")
        ? Number(fd.get("transferFeePercent"))
        : undefined,
    });
    setLoading(false);
    setOpen(false);
    setFormQuantity(1);
    setFormUnitPrice(0);
    setFormTransferFeePercent(0);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Teklif / Bütçe Kırılımları</CardTitle>
          <CardDescription>{year} yılı bütçe kalemleri</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>
            ← {year - 1}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)}>
            {year + 1} →
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={yearItems.length === 0}
            onClick={() => exportBudgetItemsToExcel(yearItems, project.projectCode || project.name)}
          >
            <Download className="h-4 w-4" /> Dışa Aktar
          </Button>
          {isSuperAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" /> İçe Aktar
              </Button>
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Kalem Ekle
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!isSuperAdmin && (
          <p className="mb-3 text-xs text-muted-foreground">
            Bütçe kırılımı kalemleri yalnızca admin tarafından eklenebilir/silinebilir.
          </p>
        )}
        <Table>
          <THead>
            <TR>
              <TH>Tip</TH>
              <TH>Kategori</TH>
              <TH>Açıklama</TH>
              <TH>Tedarikçi</TH>
              <TH className="text-right">Miktar</TH>
              <TH>Birim</TH>
              <TH className="text-right">Birim Fiyat</TH>
              <TH className="text-right">Tutar</TH>
              <TH className="text-right">TF %</TH>
              <TH className="text-right">TF Fiyatı</TH>
              <TH className="text-right">TL Karşılığı</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {yearItems.map((b) => (
              <TR key={b.id}>
                <TD>
                  <Badge tone={b.expenseType === "OPEX" ? "warning" : "default"}>
                    {b.expenseType}
                  </Badge>
                </TD>
                <TD>
                  <Badge tone="info">{b.category}</Badge>
                </TD>
                <TD>
                  {b.description}
                  {b.note && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{b.note}</div>
                  )}
                </TD>
                <TD className="text-muted-foreground">{b.supplier || "—"}</TD>
                <TD className="text-right">{b.quantity}</TD>
                <TD className="text-muted-foreground">{b.unit || "—"}</TD>
                <TD className="text-right">{formatMoney(b.unitPrice, b.currency, 2)}</TD>
                <TD className="text-right font-medium">{formatMoney(b.amount, b.currency, 2)}</TD>
                <TD className="text-right text-muted-foreground">
                  {b.transferFeePercent != null ? `%${b.transferFeePercent}` : "—"}
                </TD>
                <TD className="text-right text-muted-foreground">
                  {b.transferPrice != null ? formatMoney(b.transferPrice, b.currency, 2) : "—"}
                </TD>
                <TD className="text-right text-muted-foreground">
                  {b.currency === "TRY" ? "—" : formatMoney(b.amountTRY, "TRY", 2)}
                </TD>
                <TD>
                  {isSuperAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Sil"
                      onClick={() => deleteBudgetItem(b.id, project.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
            {yearItems.length === 0 && (
              <TR>
                <TD colSpan={12} className="py-8 text-center text-muted-foreground">
                  {year} yılı için bütçe kalemi eklenmemiş.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
        {yearItems.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {typeCurrencyTotals.map(({ expenseType, currency, amount }) => (
                <div
                  key={`${expenseType}-${currency}`}
                  className={cn(
                    "rounded-lg px-4 py-3",
                    expenseType === "OPEX" ? "bg-warning/10" : "bg-accent"
                  )}
                >
                  <div
                    className={cn(
                      "text-xs font-medium",
                      expenseType === "OPEX" ? "text-warning" : "text-primary"
                    )}
                  >
                    {expenseType} {currency}
                  </div>
                  <div className="mt-0.5 text-base font-bold">{formatMoney(amount, currency)}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
              <span className="font-medium">
                Toplam (TL karşılığı) — Hedef bütçenin %
                {project.targetBudget > 0
                  ? Math.round((totalTRY / project.targetBudget) * 100)
                  : 0}
                &apos;i
              </span>
              <span className="text-base font-bold">{formatMoney(totalTRY)}</span>
            </div>
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
              <Label>Tip</Label>
              <Select name="expenseType" defaultValue="CAPEX">
                <option value="CAPEX">CAPEX</option>
                <option value="OPEX">OPEX</option>
              </Select>
            </div>
            <div>
              <Label>Kategori</Label>
              <Input name="category" placeholder="Donanım / Yazılım / İşçilik" required />
            </div>
            <div className="col-span-2">
              <Label>Açıklama</Label>
              <Input name="description" required />
            </div>
            <div>
              <Label>Tedarikçi</Label>
              <Input name="supplier" placeholder="Opsiyonel" />
            </div>
            <div>
              <Label>Birim</Label>
              <Input name="unit" placeholder="ad, adet, gün... (opsiyonel)" />
            </div>
            <div>
              <Label>Miktar</Label>
              <Input
                name="quantity"
                type="number"
                step="0.01"
                min={0}
                value={formQuantity}
                onChange={(e) => setFormQuantity(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <Label>Birim Fiyat</Label>
              <Input
                name="unitPrice"
                type="number"
                step="0.01"
                min={0}
                value={formUnitPrice}
                onChange={(e) => setFormUnitPrice(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <Label>Para Birimi</Label>
              <CurrencySelect
                name="currency"
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value as CurrencyCode)}
              />
            </div>
            <div>
              <Label>Toplam Maliyet (KDV Hariç)</Label>
              <Input value={formatMoney(formAmount, formCurrency)} readOnly tabIndex={-1} className="bg-muted text-muted-foreground" />
            </div>
            <div>
              <Label>TF %</Label>
              <Input
                name="transferFeePercent"
                type="number"
                step="0.01"
                min={0}
                value={formTransferFeePercent}
                onChange={(e) => setFormTransferFeePercent(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>TF (Transfer Fiyatı)</Label>
              <Input
                value={formatMoney(formTransferPrice, formCurrency)}
                readOnly
                tabIndex={-1}
                className="bg-muted text-muted-foreground"
              />
            </div>
            <div className="col-span-2">
              <Label>Not</Label>
              <Input name="note" placeholder="Opsiyonel" />
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

      <BudgetImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        projectId={project.id}
        defaultYear={year}
      />
    </Card>
  );
}

function BudgetImportDialog({
  open,
  onClose,
  projectId,
  defaultYear,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultYear: number;
}) {
  const [targetYear, setTargetYear] = useState(defaultYear);
  const [parsed, setParsed] = useState<ImportedBudgetItem[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  function reset() {
    setParsed(null);
    setWarnings([]);
    setFileError(null);
    setDone(null);
  }

  async function handleFile(file: File) {
    reset();
    try {
      const result = await parseBudgetExcelFile(file);
      setParsed(result.items);
      setWarnings(result.warnings);
    } catch (err) {
      setFileError((err as Error).message);
    }
  }

  async function handleImport() {
    if (!parsed || parsed.length === 0) return;
    setImporting(true);
    const result = await importBudgetItemsForProject(
      projectId,
      parsed.map((it) => ({ ...it, year: it.year ?? targetYear }))
    );
    setImporting(false);
    setDone(result.inserted);
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      title="Bütçe Kırılımını İçe Aktar (.xlsx)"
      wide
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Uygulamanın kendi dışa aktardığı dosyayı ya da tedarikçi teklif Excel&apos;lerini
          (Tedarikçi / Miktar / Birim / Birim Maliyet / TF % gibi sütunlar içeren) doğrudan
          yükleyebilirsiniz. Satırlarda ayrı bir &quot;Yıl&quot; sütunu yoksa aşağıda seçtiğiniz
          yıl kullanılır.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => downloadBudgetTemplate()}>
          <Download className="h-4 w-4" /> Örnek Şablonu İndir
        </Button>
        <div>
          <Label>Hedef Yıl (Yıl sütunu olmayan satırlar için)</Label>
          <Input
            type="number"
            min={2000}
            max={2100}
            value={targetYear}
            onChange={(e) => setTargetYear(Number(e.target.value))}
            className="w-32"
          />
        </div>
        <div>
          <Label>Excel Dosyası</Label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-accent/80"
          />
        </div>

        {fileError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {fileError}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="space-y-1 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            {warnings.map((w, i) => (
              <div key={i}>⚠️ {w}</div>
            ))}
          </div>
        )}

        {parsed && parsed.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium">
              {parsed.length} kalem bulundu — önizleme (ilk 8 satır):
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>Tip</TH>
                  <TH>Kategori</TH>
                  <TH>Açıklama</TH>
                  <TH>Tedarikçi</TH>
                  <TH className="text-right">Miktar</TH>
                  <TH className="text-right">Birim Fiyat</TH>
                  <TH>Para Birimi</TH>
                </TR>
              </THead>
              <TBody>
                {parsed.slice(0, 8).map((it, i) => (
                  <TR key={i}>
                    <TD>{it.expenseType}</TD>
                    <TD>{it.category}</TD>
                    <TD>{it.description}</TD>
                    <TD className="text-muted-foreground">{it.supplier || "—"}</TD>
                    <TD className="text-right">{it.quantity}</TD>
                    <TD className="text-right">{it.unitPrice}</TD>
                    <TD>{it.currency}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}

        {done != null && (
          <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            {done} kalem başarıyla içe aktarıldı.
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onClose();
              reset();
            }}
          >
            {done != null ? "Kapat" : "Vazgeç"}
          </Button>
          {done == null && (
            <Button
              type="button"
              disabled={!parsed || parsed.length === 0 || importing}
              onClick={handleImport}
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />} İçe Aktar
            </Button>
          )}
        </div>
      </div>
    </Dialog>
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

  const monthValues = (field: "expenseTRY" | "incomeTRY" | "internalIncomeTRY") =>
    Array.from({ length: 12 }, (_, i) => byMonth.get(i + 1)?.[field] ?? 0);

  const expenseByMonth = monthValues("expenseTRY");
  const incomeByMonth = monthValues("incomeTRY");
  const internalByMonth = monthValues("internalIncomeTRY");
  const totals = {
    expense: expenseByMonth.reduce((s, v) => s + v, 0),
    income: incomeByMonth.reduce((s, v) => s + v, 0),
    internal: internalByMonth.reduce((s, v) => s + v, 0),
  };

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
          <span className="font-medium text-foreground">Gider ve Gelir</span>, Faturalar
          sekmesinde girilen faturaların tipine (Gider/Gelir) ve kesim tarihine göre otomatik
          hesaplanır — burada elle değiştirilemez.{" "}
          <span className="font-medium text-foreground">İç Kaynak Geliri</span> faturalardan
          bağımsızdır ve elle girilir.
        </div>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-destructive/10 px-4 py-3">
            <div className="text-xs font-medium text-destructive">Yıllık Gider (TL)</div>
            <div className="text-lg font-bold">{formatMoney(totals.expense)}</div>
          </div>
          <div className="rounded-lg bg-success/10 px-4 py-3">
            <div className="text-xs font-medium text-success">Yıllık Gelir (TL)</div>
            <div className="text-lg font-bold">{formatMoney(totals.income)}</div>
          </div>
          <div className="rounded-lg bg-accent px-4 py-3">
            <div className="text-xs font-medium text-primary">İç Kaynak Geliri (TL)</div>
            <div className="text-lg font-bold">{formatMoney(totals.internal)}</div>
          </div>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Kalem</TH>
              {MONTHS_TR_SHORT.map((m) => (
                <TH key={m} className="text-center">
                  {m}
                </TH>
              ))}
              <TH className="text-right">Toplam</TH>
            </TR>
          </THead>
          <TBody>
            <TR>
              <TD className="font-medium text-destructive">Gider</TD>
              {expenseByMonth.map((v, i) => (
                <TD key={i} className="text-center tabular-nums text-muted-foreground">
                  {v > 0 ? formatMoney(v, "TRY", 0) : "·"}
                </TD>
              ))}
              <TD className="text-right font-semibold tabular-nums">{formatMoney(totals.expense)}</TD>
            </TR>
            <TR>
              <TD className="font-medium text-success">Gelir</TD>
              {incomeByMonth.map((v, i) => (
                <TD key={i} className="text-center tabular-nums text-muted-foreground">
                  {v > 0 ? formatMoney(v, "TRY", 0) : "·"}
                </TD>
              ))}
              <TD className="text-right font-semibold tabular-nums">{formatMoney(totals.income)}</TD>
            </TR>
            <InternalIncomeRow
              projectId={project.id}
              year={year}
              internalByMonth={internalByMonth}
              total={totals.internal}
            />
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InternalIncomeRow({
  projectId,
  year,
  internalByMonth,
  total,
}: {
  projectId: string;
  year: number;
  internalByMonth: number[];
  total: number;
}) {
  return (
    <TR>
      <TD className="font-medium text-primary">İç Kaynak Geliri</TD>
      {internalByMonth.map((v, i) => (
        <TD key={i} className="p-1 text-center">
          <InternalIncomeCell projectId={projectId} year={year} month={i + 1} value={v} />
        </TD>
      ))}
      <TD className="text-right font-semibold tabular-nums">{formatMoney(total)}</TD>
    </TR>
  );
}

function InternalIncomeCell({
  projectId,
  year,
  month,
  value,
}: {
  projectId: string;
  year: number;
  month: number;
  value: number;
}) {
  const [v, setV] = useState(value);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (v === value) return;
    setSaving(true);
    await upsertInternalIncome({ projectId, year, month, internalIncome: v || 0, currency: "TRY" });
    setSaving(false);
  }

  return (
    <input
      type="number"
      step="0.01"
      min={0}
      value={v || ""}
      onChange={(e) => setV(Number(e.target.value))}
      onBlur={save}
      className={cn(
        "h-8 w-full rounded border-0 bg-transparent text-center text-sm tabular-nums outline-none focus:bg-accent",
        saving && "opacity-50"
      )}
    />
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
  const [editingInvoice, setEditingInvoice] = useState<InvoiceDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasExchangeRateDiff, setHasExchangeRateDiff] = useState(false);

  function openAddDialog() {
    setEditingInvoice(null);
    setHasExchangeRateDiff(false);
    setOpen(true);
  }

  function openEditDialog(inv: InvoiceDTO) {
    setEditingInvoice(inv);
    setHasExchangeRateDiff(inv.hasExchangeRateDiff);
    setOpen(true);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: fd.get("type") as any,
      description: String(fd.get("description")),
      amount: Number(fd.get("amount")),
      currency: fd.get("currency") as CurrencyCode,
      issueDate: String(fd.get("issueDate")),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: fd.get("status") as any,
      ebaNumber: String(fd.get("ebaNumber")),
      poNumber: fd.get("poNumber") ? String(fd.get("poNumber")) : undefined,
      hasExchangeRateDiff,
      exchangeRateDiffEbaNumber: hasExchangeRateDiff
        ? String(fd.get("exchangeRateDiffEbaNumber") ?? "")
        : undefined,
    };
    if (editingInvoice) {
      await updateInvoice(editingInvoice.id, input);
    } else {
      await addInvoice({ projectId: project.id, ...input });
    }
    setLoading(false);
    setOpen(false);
    setEditingInvoice(null);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Faturalama Takvimi</CardTitle>
        <Button size="sm" onClick={openAddDialog}>
          <Plus className="h-4 w-4" /> Fatura Ekle
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Tip</TH>
              <TH>Açıklama</TH>
              <TH>EBA No</TH>
              <TH>Kur Farkı EBA No</TH>
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
                <TD>
                  <Badge tone={inv.type === "EXPENSE" ? "destructive" : "success"}>
                    {INVOICE_TYPE_LABELS[inv.type ?? "INCOME"]}
                  </Badge>
                </TD>
                <TD className="font-medium">{inv.description}</TD>
                <TD>{inv.ebaNumber || "—"}</TD>
                <TD>{inv.hasExchangeRateDiff ? inv.exchangeRateDiffEbaNumber || "—" : "—"}</TD>
                <TD>{inv.poNumber || "—"}</TD>
                <TD className="text-muted-foreground">{formatDate(inv.issueDate)}</TD>
                <TD className="text-right font-medium">
                  {formatMoney(inv.amount, inv.currency, 2)}
                </TD>
                <TD className="text-right text-muted-foreground">
                  {inv.currency === "TRY" ? "—" : formatMoney(inv.amountTRY, "TRY", 2)}
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
                    {(() => {
                      const derived = getInvoiceDerivedStatus(inv.status, inv.issueDate);
                      return (
                        <div>
                          <Badge tone={derived.tone}>{derived.label}</Badge>
                          {derived.description && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {derived.description}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Düzenle"
                      onClick={() => openEditDialog(inv)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
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
                <TD colSpan={10} className="py-8 text-center text-muted-foreground">
                  Fatura kaydı yok.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </CardContent>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditingInvoice(null);
        }}
        title={editingInvoice ? "Fatura Düzenle" : "Fatura Ekle"}
      >
        <form key={editingInvoice?.id ?? "new"} onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Tip</Label>
              <Select name="type" defaultValue={editingInvoice?.type ?? "INCOME"}>
                {Object.entries(INVOICE_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Açıklama</Label>
              <Input name="description" defaultValue={editingInvoice?.description} required />
            </div>
            <div>
              <Label>Tutar</Label>
              <Input
                name="amount"
                type="number"
                step="0.01"
                min={0}
                defaultValue={editingInvoice?.amount}
                required
              />
            </div>
            <div>
              <Label>Para Birimi</Label>
              <CurrencySelect name="currency" defaultValue={editingInvoice?.currency} />
            </div>
            <div>
              <Label>Kesim Tarihi</Label>
              <Input
                name="issueDate"
                type="date"
                defaultValue={editingInvoice?.issueDate.slice(0, 10)}
                required
              />
            </div>
            <div>
              <Label>Durum</Label>
              <Select name="status" defaultValue={editingInvoice?.status ?? "PLANNED"}>
                {Object.entries(INVOICE_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>EBA No</Label>
              <Input
                name="ebaNumber"
                defaultValue={editingInvoice?.ebaNumber ?? ""}
                required
              />
            </div>
            <div>
              <Label>P.O. No</Label>
              <Input
                name="poNumber"
                placeholder="Opsiyonel"
                defaultValue={editingInvoice?.poNumber ?? ""}
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="hasExchangeRateDiff"
                type="checkbox"
                className="h-4 w-4"
                checked={hasExchangeRateDiff}
                onChange={(e) => setHasExchangeRateDiff(e.target.checked)}
              />
              <Label htmlFor="hasExchangeRateDiff" className="!mb-0">
                Kur Farkı
              </Label>
            </div>
            {hasExchangeRateDiff && (
              <div className="col-span-2">
                <Label>Kur Farkı EBA No</Label>
                <Input
                  name="exchangeRateDiffEbaNumber"
                  defaultValue={editingInvoice?.exchangeRateDiffEbaNumber ?? ""}
                  required
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditingInvoice(null);
              }}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
              {editingInvoice ? "Kaydet" : "Ekle"}
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
  pipelineCode: "Pipeline Kodu (PTM)",
  factories: "Fabrika(lar)",
  probability: "Gerçekleşme İhtimali",
  targetBudget: "Hedef Bütçe",
  startDate: "Başlangıç Tarihi",
  endDate: "Bitiş Tarihi",
  riskLevel: "Risk Derecesi",
  priority: "Öncelik",
  status: "Durum",
  description: "Açıklama",
  jiraLink: "JIRA Linki",
  paymentPlanNote: "Ödeme Planı",
  kind: "Tür",
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
