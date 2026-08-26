"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  CalendarDays,
  Receipt,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { PtForm } from "../pt-form";
import {
  addPtInvoice,
  updatePtInvoice,
  updatePtInvoiceStatus,
  deletePtInvoice,
  upsertPtMonthlyFinancial,
} from "@/app/actions/pt";
import type { PtDTO, PtInvoiceDTO, PtMonthlyFinancialDTO, RatesDTO } from "@/lib/types";
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
  MONTHS_TR,
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
  const controlledProps = value !== undefined ? { value, onChange } : { defaultValue };
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

type Tab = "invoices" | "monthly";

const tabs: { id: Tab; label: string; icon: typeof Receipt }[] = [
  { id: "invoices", label: "Faturalar", icon: Receipt },
  { id: "monthly", label: "Aylık Finans", icon: CalendarDays },
];

export function PtDetailClient(props: {
  pt: PtDTO;
  invoices: PtInvoiceDTO[];
  financials: PtMonthlyFinancialDTO[];
  rates: RatesDTO;
}) {
  const { pt } = props;
  const [tab, setTab] = useState<Tab>("invoices");
  const [editing, setEditing] = useState(false);

  const ciro = props.financials.reduce((s, f) => s + f.incomeTRY, 0);
  const gider = props.financials.reduce((s, f) => s + f.expenseTRY, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/pt"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> PT Kodları
          </Link>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span className="font-mono text-xl text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {pt.ptCode}
            </span>
            {pt.pipelineCode && (
              <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                PTM: {pt.pipelineCode}
              </span>
            )}
            {pt.name}
          </h1>
          {pt.description && (
            <p className="mt-1 text-sm text-muted-foreground">{pt.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={pt.status === "ACTIVE" ? "success" : "info"}>
              {STATUS_LABELS[pt.status]}
            </Badge>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" /> Düzenle
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">PT Cirosu (TL)</p>
            <p className="mt-1 text-xl font-bold">{formatMoney(ciro, "TRY", 2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">PT Gideri (TL)</p>
            <p className="mt-1 text-xl font-bold">{formatMoney(gider, "TRY", 2)}</p>
          </CardContent>
        </Card>
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
        {tab === "invoices" && <PtInvoicesTab {...props} />}
        {tab === "monthly" && <PtMonthlyTab {...props} />}
      </div>

      <Dialog open={editing} onClose={() => setEditing(false)} title="PT Düzenle">
        <PtForm pt={pt} onDone={() => setEditing(false)} />
      </Dialog>
    </div>
  );
}

// ── PT Faturaları ─────────────────────────────────────────

function PtInvoicesTab({ pt, invoices }: { pt: PtDTO; invoices: PtInvoiceDTO[] }) {
  const [open, setOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<PtInvoiceDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasExchangeRateDiff, setHasExchangeRateDiff] = useState(false);

  function openAddDialog() {
    setEditingInvoice(null);
    setHasExchangeRateDiff(false);
    setOpen(true);
  }

  function openEditDialog(inv: PtInvoiceDTO) {
    setEditingInvoice(inv);
    setHasExchangeRateDiff(inv.hasExchangeRateDiff);
    setOpen(true);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const input = {
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
      await updatePtInvoice(editingInvoice.id, input);
    } else {
      await addPtInvoice({ ptId: pt.id, ...input });
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
                    onChange={(e) => updatePtInvoiceStatus(inv.id, e.target.value as any)}
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
                      onClick={() => deletePtInvoice(inv.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
            {invoices.length === 0 && (
              <TR>
                <TD colSpan={9} className="py-8 text-center text-muted-foreground">
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

// ── PT Aylık Finans ────────────────────────────────────────

function PtMonthlyTab({ pt, financials }: { pt: PtDTO; financials: PtMonthlyFinancialDTO[] }) {
  const [year, setYear] = useState(new Date().getFullYear());

  const byMonth = useMemo(() => {
    const map = new Map<number, PtMonthlyFinancialDTO>();
    financials.filter((f) => f.year === year).forEach((f) => map.set(f.month, f));
    return map;
  }, [financials, year]);

  const totals = MONTHS_TR.reduce(
    (acc, _, i) => {
      const f = byMonth.get(i + 1);
      acc.income += f?.incomeTRY ?? 0;
      acc.expense += f?.expenseTRY ?? 0;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Aylık Gelir / Gider — {year}</CardTitle>
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
          <span className="font-medium text-foreground">Gelir:</span> girdiğiniz giderin %5
          fazlası olarak otomatik önerilir, ancak gerçek gelir daha yüksekse üzerine yazabilirsiniz
          (minimum gider + %5&apos;in altına inemez).
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-success/10 px-4 py-3">
            <div className="text-xs font-medium text-success">PT Yıllık Gelir (TL)</div>
            <div className="text-lg font-bold">{formatMoney(totals.income, "TRY", 2)}</div>
          </div>
          <div className="rounded-lg bg-destructive/10 px-4 py-3">
            <div className="text-xs font-medium text-destructive">PT Yıllık Gider (TL)</div>
            <div className="text-lg font-bold">{formatMoney(totals.expense, "TRY", 2)}</div>
          </div>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Ay</TH>
              <TH>Gider</TH>
              <TH>Gelir (min. +%5)</TH>
              <TH>Para Birimi</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {MONTHS_TR.map((name, i) => (
              <PtMonthlyRow
                key={i + 1}
                ptId={pt.id}
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

function PtMonthlyRow({
  ptId,
  year,
  month,
  name,
  data,
}: {
  ptId: string;
  year: number;
  month: number;
  name: string;
  data?: PtMonthlyFinancialDTO;
}) {
  const [expense, setExpense] = useState<number>(data?.expense ?? 0);
  const minIncome = Math.round(expense * INCOME_MARKUP * 100) / 100;
  const [income, setIncome] = useState<number>(data?.income ?? minIncome);
  const [incomeEdited, setIncomeEdited] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>(data?.currency ?? "TRY");
  const [saving, setSaving] = useState(false);

  function handleExpenseChange(value: number) {
    setExpense(value);
    if (!incomeEdited) {
      setIncome(Math.round(value * INCOME_MARKUP * 100) / 100);
    }
  }

  async function save() {
    setSaving(true);
    await upsertPtMonthlyFinancial({
      ptId,
      year,
      month,
      expense,
      income,
      currency,
    });
    setSaving(false);
  }

  return (
    <TR>
      <TD className="font-medium">{name}</TD>
      <TD>
        <Input
          type="number"
          step="0.01"
          value={expense}
          onChange={(e) => handleExpenseChange(Number(e.target.value))}
          className="h-8"
        />
      </TD>
      <TD>
        <Input
          type="number"
          step="0.01"
          min={minIncome}
          value={income}
          onChange={(e) => {
            setIncome(Number(e.target.value));
            setIncomeEdited(true);
          }}
          className="h-8"
        />
      </TD>
      <TD>
        <Select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
          className="h-8 w-24"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </TD>
      <TD>
        <Button size="sm" variant="outline" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Kaydet"}
        </Button>
      </TD>
    </TR>
  );
}
