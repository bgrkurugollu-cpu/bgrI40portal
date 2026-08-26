"use client";

import { Fragment, useMemo, useState, type FormEvent } from "react";
import {
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
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Banknote,
  Wallet,
  TrendingDown,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  upsertCapexBudget,
  addMainItem,
  updateMainItem,
  deleteMainItem,
  addSubItem,
  updateSubItem,
  deleteSubItem,
} from "@/app/actions/capex";
import type { CapexBudgetDTO, CapexMainItemDTO, CapexSubItemDTO, FactoryDTO } from "@/lib/types";
import { CURRENCIES, CURRENCY_LABELS, CurrencyCode, formatMoney } from "@/lib/utils";

function usedOf(m: CapexMainItemDTO) {
  return m.subItems.length > 0 ? m.subItems.reduce((s, si) => s + si.budget, 0) : m.spent;
}

export function CapexClient({
  budgets,
  factories,
  isAdmin,
}: {
  budgets: CapexBudgetDTO[];
  factories: FactoryDTO[];
  isAdmin: boolean;
}) {
  const years = useMemo(() => budgets.map((b) => b.year).sort((a, b) => b - a), [budgets]);
  const [year, setYear] = useState(() => {
    const current = new Date().getFullYear();
    return years.includes(current) ? current : (years[0] ?? current);
  });
  const budget = budgets.find((b) => b.year === year) ?? null;

  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [mainDialogOpen, setMainDialogOpen] = useState(false);
  const [editingMain, setEditingMain] = useState<CapexMainItemDTO | null>(null);
  const [subDialogFor, setSubDialogFor] = useState<CapexMainItemDTO | null>(null);
  const [editingSub, setEditingSub] = useState<CapexSubItemDTO | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(budget?.mainItems.filter((m) => m.subItems.length > 0).map((m) => m.id) ?? [])
  );

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totals = useMemo(() => {
    if (!budget) return { budget: 0, used: 0, remaining: 0, overCount: 0 };
    let b = 0;
    let u = 0;
    let overCount = 0;
    for (const m of budget.mainItems) {
      const used = usedOf(m);
      b += m.budget;
      u += used;
      if (used > m.budget) overCount++;
    }
    return { budget: b, used: u, remaining: b - u, overCount };
  }, [budget]);

  const unallocated = budget && budget.totalBudget > 0 ? budget.totalBudget - totals.budget : null;

  const chartData = useMemo(
    () =>
      (budget?.mainItems ?? []).map((m) => ({
        name: m.title.length > 18 ? m.title.slice(0, 17) + "…" : m.title,
        fullName: m.title,
        Bütçe: Math.round(m.budget),
        Kullanılan: Math.round(usedOf(m)),
      })),
    [budget]
  );

  async function onDeleteMain(m: CapexMainItemDTO) {
    if (!window.confirm(`"${m.title}" ana kalemini (ve alt kalemlerini) silmek istediğinize emin misiniz?`))
      return;
    await deleteMainItem(m.id);
  }

  async function onDeleteSub(s: CapexSubItemDTO) {
    if (!window.confirm(`"${s.title}" alt kalemini silmek istediğinize emin misiniz?`)) return;
    await deleteSubItem(s.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dijital CAPEX Bütçesi</h1>
          <p className="text-sm text-muted-foreground">
            Yıllık onaylanan CAPEX bütçesinin ana kalem → alt proje kırılımı
          </p>
        </div>
        <div className="flex items-center gap-2">
          {years.length > 0 && (
            <Select className="w-28" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setBudgetDialogOpen(true)}>
              <Pencil className="h-4 w-4" /> {budget ? "Bütçe Yılını Düzenle" : "Yeni Bütçe Yılı"}
            </Button>
          )}
        </div>
      </div>

      {!budget ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {years.length === 0
              ? "Henüz CAPEX bütçesi tanımlanmamış."
              : `${year} yılı için tanımlanmış bir CAPEX bütçesi yok.`}
            {isAdmin && (
              <div className="mt-4">
                <Button onClick={() => setBudgetDialogOpen(true)}>
                  <Plus className="h-4 w-4" /> Bütçe Yılı Oluştur
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Kpi
              icon={Banknote}
              label={`Toplam Bütçe (${budget.currency})`}
              value={formatMoney(budget.totalBudget > 0 ? budget.totalBudget : totals.budget, budget.currency, 0)}
            />
            <Kpi icon={Wallet} label="Kullanılan" value={formatMoney(totals.used, budget.currency, 0)} />
            <Kpi
              icon={TrendingDown}
              label={unallocated !== null ? "Tahsis Edilmemiş" : "Kalan (Ana Kalemler)"}
              value={formatMoney(unallocated !== null ? unallocated : totals.remaining, budget.currency, 0)}
              warn={(unallocated ?? totals.remaining) < 0}
            />
            <Kpi
              icon={AlertTriangle}
              label="Aşım Olan Ana Kalem"
              value={String(totals.overCount)}
              warn={totals.overCount > 0}
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{budget.title || `${budget.year} CAPEX Bütçesi`}</CardTitle>
              {isAdmin && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingMain(null);
                    setMainDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Ana Kalem Ekle
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>Ana Kalem / Proje</TH>
                    <TH>Fabrikalar</TH>
                    <TH className="text-right">Bütçe</TH>
                    <TH className="text-right">Kullanılan</TH>
                    <TH className="text-right">Kalan / Aşım</TH>
                    <TH>Açıklama / Not</TH>
                    {isAdmin && <TH></TH>}
                  </TR>
                </THead>
                <TBody>
                  {budget.mainItems.map((m) => {
                    const used = usedOf(m);
                    const remaining = m.budget - used;
                    const isOver = remaining < 0;
                    const hasChildren = m.subItems.length > 0;
                    return (
                      <Fragment key={m.id}>
                        <TR className="bg-accent/20">
                          <TD className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {hasChildren ? (
                                <button onClick={() => toggleExpand(m.id)} className="text-muted-foreground hover:text-foreground">
                                  {expanded.has(m.id) ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              ) : (
                                <span className="inline-block w-3.5" />
                              )}
                              {m.title}
                            </div>
                          </TD>
                          <TD className="text-xs text-muted-foreground">
                            {m.factoryNames.join(", ") || "—"}
                          </TD>
                          <TD className="text-right font-medium">{formatMoney(m.budget, budget.currency, 0)}</TD>
                          <TD className="text-right">{formatMoney(used, budget.currency, 0)}</TD>
                          <TD className="text-right">
                            <Badge tone={isOver ? "destructive" : "success"}>
                              {isOver ? "Aşım " : "Kalan "}
                              {formatMoney(Math.abs(remaining), budget.currency, 0)}
                            </Badge>
                          </TD>
                          <TD className="max-w-[280px] truncate text-xs text-muted-foreground" title={m.description ?? ""}>
                            {m.description || "—"}
                          </TD>
                          {isAdmin && (
                            <TD>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Alt kalem ekle"
                                  onClick={() => {
                                    setEditingSub(null);
                                    setSubDialogFor(m);
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Düzenle"
                                  onClick={() => {
                                    setEditingMain(m);
                                    setMainDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => onDeleteMain(m)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TD>
                          )}
                        </TR>
                        {hasChildren &&
                          expanded.has(m.id) &&
                          m.subItems.map((s) => (
                            <TR key={s.id}>
                              <TD className="pl-9 text-sm text-muted-foreground">↳ {s.title}</TD>
                              <TD></TD>
                              <TD className="text-right text-sm">{formatMoney(s.budget, budget.currency, 0)}</TD>
                              <TD></TD>
                              <TD></TD>
                              <TD className="max-w-[280px] truncate text-xs text-muted-foreground" title={s.note ?? ""}>
                                {s.note || "—"}
                              </TD>
                              {isAdmin && (
                                <TD>
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Düzenle"
                                      onClick={() => {
                                        setEditingSub(s);
                                        setSubDialogFor(m);
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => onDeleteSub(s)}>
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </TD>
                              )}
                            </TR>
                          ))}
                      </Fragment>
                    );
                  })}
                  {budget.mainItems.length === 0 && (
                    <TR>
                      <TD colSpan={isAdmin ? 7 : 6} className="py-10 text-center text-muted-foreground">
                        Henüz ana kalem yok.
                      </TD>
                    </TR>
                  )}
                </TBody>
                {budget.mainItems.length > 0 && (
                  <tfoot>
                    <TR className="font-semibold">
                      <TD colSpan={2}>TOPLAM</TD>
                      <TD className="text-right">{formatMoney(totals.budget, budget.currency, 0)}</TD>
                      <TD className="text-right">{formatMoney(totals.used, budget.currency, 0)}</TD>
                      <TD className="text-right">
                        <Badge tone={totals.remaining < 0 ? "destructive" : "muted"}>
                          {formatMoney(totals.remaining, budget.currency, 0)}
                        </Badge>
                      </TD>
                      <TD></TD>
                      {isAdmin && <TD></TD>}
                    </TR>
                    {unallocated !== null && (
                      <TR className="text-xs text-muted-foreground">
                        <TD colSpan={2}>Onaylı bütçe içinde tahsis edilmemiş kalan</TD>
                        <TD colSpan={isAdmin ? 5 : 4} className="text-right">
                          {formatMoney(unallocated, budget.currency, 0)}
                        </TD>
                      </TR>
                    )}
                  </tfoot>
                )}
              </Table>
            </CardContent>
          </Card>

          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ana Kalem Bazında Bütçe vs Kullanılan</CardTitle>
                <CardDescription>Her ana kalemin onaylı bütçesi ve fiili/tahsisli kullanımı</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ height: Math.max(220, chartData.length * 48) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        stroke="var(--muted-foreground)"
                        width={140}
                      />
                      <Tooltip
                        formatter={(v) => formatMoney(Number(v), budget.currency, 0)}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          color: "var(--foreground)",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Bütçe" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="Kullanılan" fill="var(--warning)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <BudgetDialog
        open={budgetDialogOpen}
        onClose={() => setBudgetDialogOpen(false)}
        budget={budget}
        defaultYear={year}
      />
      <MainItemDialog
        open={mainDialogOpen}
        onClose={() => setMainDialogOpen(false)}
        capexBudgetId={budget?.id ?? ""}
        item={editingMain}
        factories={factories}
      />
      <SubItemDialog
        open={!!subDialogFor}
        onClose={() => {
          setSubDialogFor(null);
          setEditingSub(null);
        }}
        mainItem={subDialogFor}
        item={editingSub}
      />
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
          <div className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="truncate text-base font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetDialog({
  open,
  onClose,
  budget,
  defaultYear,
}: {
  open: boolean;
  onClose: () => void;
  budget: CapexBudgetDTO | null;
  defaultYear: number;
}) {
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await upsertCapexBudget({
        year: Number(fd.get("year")),
        currency: fd.get("currency") as CurrencyCode,
        title: (fd.get("title") as string) || null,
        totalBudget: Number(fd.get("totalBudget")),
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={budget ? "Bütçe Yılını Düzenle" : "Yeni Bütçe Yılı"}>
      <form key={budget?.id ?? "new"} onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Yıl</Label>
            <Input name="year" type="number" defaultValue={budget?.year ?? defaultYear} required />
          </div>
          <div>
            <Label>Para Birimi</Label>
            <Select name="currency" defaultValue={budget?.currency ?? "TRY"}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Başlık</Label>
            <Input name="title" defaultValue={budget?.title ?? ""} placeholder="örn. 2026 Dijital CAPEX Bütçesi" />
          </div>
          <div className="col-span-2">
            <Label>Onaylı Toplam Bütçe</Label>
            <Input
              name="totalBudget"
              type="number"
              step="0.01"
              min={0}
              defaultValue={budget?.totalBudget ?? 0}
              placeholder="0 bırakılırsa ana kalem toplamı esas alınır"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Kaydet
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function MainItemDialog({
  open,
  onClose,
  capexBudgetId,
  item,
  factories,
}: {
  open: boolean;
  onClose: () => void;
  capexBudgetId: string;
  item: CapexMainItemDTO | null;
  factories: FactoryDTO[];
}) {
  const [loading, setLoading] = useState(false);
  const [factoryIds, setFactoryIds] = useState<string[]>(item?.factoryIds ?? []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      title: String(fd.get("title")),
      budget: Number(fd.get("budget")),
      spent: Number(fd.get("spent") ?? 0),
      description: (fd.get("description") as string) || null,
      factoryIds,
    };
    try {
      if (item) {
        await updateMainItem(item.id, input);
      } else {
        await addMainItem({ capexBudgetId, ...input });
      }
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={item ? "Ana Kalemi Düzenle" : "Yeni Ana Kalem"} wide>
      <form key={item?.id ?? "new"} onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Başlık</Label>
            <Input name="title" defaultValue={item?.title} required />
          </div>
          <div>
            <Label>Bütçe</Label>
            <Input name="budget" type="number" step="0.01" min={0} defaultValue={item?.budget ?? 0} required />
          </div>
          <div>
            <Label>Kullanılan (alt kalem yoksa)</Label>
            <Input name="spent" type="number" step="0.01" min={0} defaultValue={item?.spent ?? 0} />
          </div>
          <div className="col-span-2">
            <Label>Fabrikalar</Label>
            <MultiSelect
              options={factories.map((f) => ({ value: f.id, label: f.name }))}
              selected={factoryIds}
              onChange={setFactoryIds}
              placeholder="Fabrika seçin"
            />
          </div>
          <div className="col-span-2">
            <Label>Açıklama</Label>
            <Input name="description" defaultValue={item?.description ?? ""} placeholder="Kısa açıklama / not" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Bu kalemin altına alt proje/kalem eklerseniz (satırdaki + ikonuyla), &quot;Kullanılan&quot;
          otomatik olarak alt kalemlerin toplamından hesaplanır ve buradaki &quot;Kullanılan&quot;
          alanı dikkate alınmaz.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Kaydet
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function SubItemDialog({
  open,
  onClose,
  mainItem,
  item,
}: {
  open: boolean;
  onClose: () => void;
  mainItem: CapexMainItemDTO | null;
  item: CapexSubItemDTO | null;
}) {
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mainItem) return;
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      title: String(fd.get("title")),
      budget: Number(fd.get("budget")),
      note: (fd.get("note") as string) || null,
    };
    try {
      if (item) {
        await updateSubItem(item.id, input);
      } else {
        await addSubItem({ mainItemId: mainItem.id, ...input });
      }
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={item ? "Alt Kalemi Düzenle" : `Alt Kalem Ekle — ${mainItem?.title ?? ""}`}
    >
      <form key={item?.id ?? "new"} onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Başlık</Label>
            <Input name="title" defaultValue={item?.title} required />
          </div>
          <div className="col-span-2">
            <Label>Bütçe</Label>
            <Input name="budget" type="number" step="0.01" min={0} defaultValue={item?.budget ?? 0} required />
          </div>
          <div className="col-span-2">
            <Label>Not</Label>
            <Input name="note" defaultValue={item?.note ?? ""} placeholder="Opsiyonel" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Kaydet
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
