"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
import { ChevronRight, Pencil, Trash2, Plus, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useSort, SortTH, type SortValue } from "@/components/ui/sortable";
import type { AssignmentDTO, MemberDTO } from "@/lib/types";
import { cn, MONTHS_TR, MONTHS_TR_SHORT } from "@/lib/utils";
import { workingDaysByMonth } from "@/lib/workdays";
import { upsertAssignment, deleteAssignment } from "@/app/actions/projects";

type Row = AssignmentDTO & { projectName: string };

function assignmentValue(a: Row, key: string): SortValue {
  switch (key) {
    case "code":
      return a.projectCode;
    case "project":
      return a.projectName;
    case "member":
      return a.memberName;
    case "period":
      return a.year * 100 + a.month;
    case "planned":
      return a.plannedDays;
    case "actual":
      return a.actualDays;
    case "resources":
      return a.resources;
    default:
      return null;
  }
}

type EditDraft = { plannedDays: string; actualDays: string; resources: string };
type AddDraft = {
  projectId: string;
  memberId: string;
  year: string;
  month: string;
  plannedDays: string;
  actualDays: string;
  resources: string;
};

export function ResourcesClient({
  assignments,
  members,
  projects,
}: {
  assignments: Row[];
  members: MemberDTO[];
  projects: { id: string; name: string }[];
}) {
  const years = useMemo(
    () =>
      Array.from(new Set(assignments.map((a) => a.year))).sort((a, b) => a - b),
    [assignments]
  );
  const [year, setYear] = useState(
    years.includes(new Date().getFullYear())
      ? new Date().getFullYear()
      : (years[0] ?? new Date().getFullYear())
  );
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const filtered = useMemo(
    () =>
      assignments.filter(
        (a) =>
          a.year === year &&
          (projectFilter === "all" || a.projectId === projectFilter)
      ),
    [assignments, year, projectFilter]
  );

  // Üye x Ay planlanan yük matrisi
  const load = useMemo(() => {
    const map = new Map<string, number[]>();
    members.forEach((m) => map.set(m.id, Array(12).fill(0)));
    filtered.forEach((a) => {
      const arr = map.get(a.memberId);
      if (arr) arr[a.month - 1] += a.plannedDays;
    });
    return map;
  }, [filtered, members]);

  // Üye x Ay sapma matrisi (Gerçekleşen - Planlanan)
  const deviation = useMemo(() => {
    const map = new Map<string, number[]>();
    members.forEach((m) => map.set(m.id, Array(12).fill(0)));
    filtered.forEach((a) => {
      const arr = map.get(a.memberId);
      if (arr) arr[a.month - 1] += (a.actualDays - a.plannedDays);
    });
    return map;
  }, [filtered, members]);

  // Aylık plan vs gerçekleşen grafik verisi
  const chartData = useMemo(
    () =>
      MONTHS_TR_SHORT.map((name, i) => {
        const monthRows = filtered.filter((a) => a.month === i + 1);
        return {
          name,
          Planlanan: monthRows.reduce((s, a) => s + a.plannedDays, 0),
          Gerçekleşen: monthRows.reduce((s, a) => s + a.actualDays, 0),
        };
      }),
    [filtered]
  );

  // Her ay için 2026 çalışma günü (hafta içi − resmi tatil − köprü izin)
  const workDays = useMemo(() => workingDaysByMonth(year), [year]);
  const totalWorkDays = useMemo(
    () => workDays.reduce((s, d) => s + d, 0),
    [workDays]
  );
  const teamCapacityYear = members.length * totalWorkDays;

  const cellClass = (v: number, monthIndex: number) => {
    if (v === 0) return "text-muted-foreground/40";
    const capacity = workDays[monthIndex] || 1;
    const ratio = v / capacity;
    if (ratio > 1) return "bg-destructive/15 font-semibold text-destructive";
    if (ratio > 0.8) return "bg-warning/20 font-medium";
    return "bg-success/10";
  };

  // ── Atama Detayları: sıralama + aç/kapa + satır içi düzenleme + ekle/sil ──
  const { sorted: sortedRows, sortKey, sortDir, toggleSort } = useSort(
    filtered,
    assignmentValue,
    { key: "member", dir: "asc" }
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ plannedDays: "", actualDays: "", resources: "" });
  const [busyId, setBusyId] = useState<string | null>(null); // kaydedilen/silinen satır id'si
  const [adding, setAdding] = useState(false);
  const emptyAdd: AddDraft = {
    projectId: "",
    memberId: "",
    year: String(year),
    month: String(new Date().getMonth() + 1),
    plannedDays: "0",
    actualDays: "0",
    resources: "",
  };
  const [addDraft, setAddDraft] = useState<AddDraft>(emptyAdd);
  const [error, setError] = useState<string | null>(null);

  function startEdit(a: Row) {
    setError(null);
    setEditingId(a.id);
    setDraft({
      plannedDays: String(a.plannedDays),
      actualDays: String(a.actualDays),
      resources: a.resources ?? "",
    });
  }

  async function saveEdit(a: Row) {
    setBusyId(a.id);
    setError(null);
    try {
      await upsertAssignment({
        projectId: a.projectId,
        memberId: a.memberId,
        year: a.year,
        month: a.month,
        plannedDays: Number(draft.plannedDays) || 0,
        actualDays: Number(draft.actualDays) || 0,
        resources: draft.resources.trim() || null,
      });
      setEditingId(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeRow(a: Row) {
    if (!window.confirm(`${a.projectCode} / ${a.memberName} atamasını silmek istediğinize emin misiniz?`))
      return;
    setBusyId(a.id);
    setError(null);
    try {
      await deleteAssignment(a.id, a.projectId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function saveAdd() {
    if (!addDraft.projectId || !addDraft.memberId) {
      setError("Proje ve üye seçmelisiniz.");
      return;
    }
    setBusyId("__add__");
    setError(null);
    try {
      await upsertAssignment({
        projectId: addDraft.projectId,
        memberId: addDraft.memberId,
        year: Number(addDraft.year) || year,
        month: Number(addDraft.month) || 1,
        plannedDays: Number(addDraft.plannedDays) || 0,
        actualDays: Number(addDraft.actualDays) || 0,
        resources: addDraft.resources.trim() || null,
      });
      setAdding(false);
      setAddDraft(emptyAdd);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kaynak Planı</h1>
          <p className="text-sm text-muted-foreground">
            5 kişilik Endüstri 4.0 ekibi için bütünsel kapasite görünümü — {year}
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

      <Card>
        <CardHeader>
          <CardTitle>Ekip Yük Matrisi (planlanan adam-gün / ay)</CardTitle>
          <CardDescription>
            Kapasite, her ay için 2026 çalışma günü sayısına göre hesaplanır (hafta
            içi günlerden resmi tatiller ve köprü izinleri düşülür). Kırmızı hücreler
            ilgili ayın kapasitesinin aşımını gösterir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Ekip Üyesi</TH>
                {MONTHS_TR_SHORT.map((m) => (
                  <TH key={m} className="text-center">
                    {m}
                  </TH>
                ))}
                <TH className="text-right">Toplam</TH>
              </TR>
            </THead>
            <TBody>
              {members.map((m) => {
                const arr = load.get(m.id) ?? [];
                const total = arr.reduce((s, v) => s + v, 0);
                return (
                  <TR key={m.id}>
                    <TD>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.title}</div>
                    </TD>
                    {arr.map((v, i) => (
                      <TD key={i} className={cn("text-center tabular-nums", cellClass(v, i))}>
                        {v > 0 ? v : "·"}
                      </TD>
                    ))}
                    <TD className="text-right font-semibold tabular-nums">{total}</TD>
                  </TR>
                );
              })}
              <TR className="bg-muted/50">
                <TD className="font-semibold">Ekip Toplamı</TD>
                {MONTHS_TR_SHORT.map((_, i) => {
                  const sum = members.reduce(
                    (s, m) => s + (load.get(m.id)?.[i] ?? 0),
                    0
                  );
                  return (
                    <TD key={i} className="text-center font-semibold tabular-nums">
                      {sum > 0 ? sum : "·"}
                    </TD>
                  );
                })}
                <TD className="text-right font-bold tabular-nums">
                  {members.reduce(
                    (s, m) => s + (load.get(m.id)?.reduce((a, b) => a + b, 0) ?? 0),
                    0
                  )}
                </TD>
              </TR>
              <TR className="border-t-2">
                <TD className="text-xs font-medium text-muted-foreground">
                  Çalışma Günü ({year})
                </TD>
                {workDays.map((d, i) => (
                  <TD
                    key={i}
                    className="text-center text-xs tabular-nums text-muted-foreground"
                  >
                    {d}
                  </TD>
                ))}
                <TD className="text-right text-xs font-semibold tabular-nums text-muted-foreground">
                  {totalWorkDays}
                </TD>
              </TR>
            </TBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Kapasite, {year} resmi tatilleri ve köprü izinleri düşülerek her ay için
            ayrı hesaplanır. Ekip yıllık toplam kapasitesi: {teamCapacityYear} adam-gün.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planlanan vs Gerçekleşen Efor</CardTitle>
          <CardDescription>Aylık toplam adam-gün karşılaştırması</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
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

      {/* Kişi Bazlı Aylık Sapma Tablosu — okunabilirlik için Atama Detayları'nın üstünde */}
      <Card>
        <CardHeader>
          <CardTitle>Kişi Bazlı Aylık Sapma Tablosu</CardTitle>
          <CardDescription>
            Gerçekleşen ile planlanan efor farkı (Gerçekleşen - Planlanan). Kırmızı: Fazla mesai (Overload), Sarı: Eksik efor (Underload).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Ekip Üyesi</TH>
                {MONTHS_TR_SHORT.map((m) => (
                  <TH key={m} className="text-center">
                    {m}
                  </TH>
                ))}
                <TH className="text-right">Net Sapma</TH>
              </TR>
            </THead>
            <TBody>
              {members.map((m) => {
                const arr = deviation.get(m.id) ?? [];
                const total = arr.reduce((s, v) => s + v, 0);
                return (
                  <TR key={m.id}>
                    <TD>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.title}</div>
                    </TD>
                    {arr.map((v, i) => {
                      let bgClass = "bg-success/10";
                      if (v > 0) bgClass = "bg-destructive/15 font-semibold text-destructive";
                      else if (v < 0) bgClass = "bg-warning/20 font-medium text-amber-600 dark:text-amber-500";

                      return (
                        <TD key={i} className={cn("text-center tabular-nums", v !== 0 ? bgClass : "text-muted-foreground/40")}>
                          {v > 0 ? `+${v}` : v < 0 ? v : "·"}
                        </TD>
                      );
                    })}
                    <TD className="text-right font-bold tabular-nums">
                      <span className={total > 0 ? "text-destructive" : total < 0 ? "text-amber-600 dark:text-amber-500" : ""}>
                        {total > 0 ? `+${total}` : total}
                      </span>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Atama Detayları — açılıp kapanabilen, satır içi düzenlenebilir tablo */}
      <Card>
        <CardHeader
          className="flex-row items-center justify-between cursor-pointer select-none"
          onClick={() => setDetailsOpen((o) => !o)}
        >
          <div>
            <CardTitle>Atama Detayları</CardTitle>
            <CardDescription>
              {filtered.length} satırlık atama detayı
              {detailsOpen ? "" : " — genişletmek için tıklayın"}
            </CardDescription>
          </div>
          <ChevronRight
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
              detailsOpen && "rotate-90"
            )}
          />
        </CardHeader>
        <AnimatePresence initial={false}>
          {detailsOpen && (
            <motion.div
              key="atama-detay"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CardContent>
                {error && (
                  <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Table>
                  <THead>
                    <TR>
                      <SortTH label="Proje Kodu" col="code" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTH label="Proje" col="project" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTH label="Üye" col="member" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTH label="Dönem" col="period" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTH label="Plan" col="planned" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="text-right" />
                      <SortTH label="Gerçekleşen" col="actual" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="text-right" />
                      <SortTH label="Kaynaklar" col="resources" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <TH className="text-right">İşlem</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {sortedRows.map((a) => {
                      const editing = editingId === a.id;
                      const busy = busyId === a.id;
                      return (
                        <TR key={a.id}>
                          <TD className="font-mono text-xs font-bold text-muted-foreground">
                            {a.projectCode}
                          </TD>
                          <TD>
                            <Link
                              href={`/projects/${a.projectId}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {a.projectName}
                            </Link>
                          </TD>
                          <TD>{a.memberName}</TD>
                          <TD className="text-muted-foreground">
                            {MONTHS_TR_SHORT[a.month - 1]} {a.year}
                          </TD>
                          {editing ? (
                            <>
                              <TD className="text-right">
                                <Input
                                  type="number"
                                  step="0.5"
                                  min={0}
                                  className="h-8 w-20 text-right tabular-nums"
                                  value={draft.plannedDays}
                                  onChange={(e) =>
                                    setDraft((d) => ({ ...d, plannedDays: e.target.value }))
                                  }
                                />
                              </TD>
                              <TD className="text-right">
                                <Input
                                  type="number"
                                  step="0.5"
                                  min={0}
                                  className="h-8 w-20 text-right tabular-nums"
                                  value={draft.actualDays}
                                  onChange={(e) =>
                                    setDraft((d) => ({ ...d, actualDays: e.target.value }))
                                  }
                                />
                              </TD>
                              <TD>
                                <Input
                                  className="h-8"
                                  value={draft.resources}
                                  placeholder="Kaynak kişiler"
                                  onChange={(e) =>
                                    setDraft((d) => ({ ...d, resources: e.target.value }))
                                  }
                                />
                              </TD>
                              <TD>
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-success"
                                    disabled={busy}
                                    onClick={() => saveEdit(a)}
                                    title="Kaydet"
                                  >
                                    {busy ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={busy}
                                    onClick={() => setEditingId(null)}
                                    title="Vazgeç"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TD>
                            </>
                          ) : (
                            <>
                              <TD className="text-right tabular-nums">{a.plannedDays}</TD>
                              <TD className="text-right tabular-nums">{a.actualDays}</TD>
                              <TD className="text-muted-foreground">{a.resources ?? "—"}</TD>
                              <TD>
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={busy || editingId !== null}
                                    onClick={() => startEdit(a)}
                                    title="Düzenle"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    disabled={busy || editingId !== null}
                                    onClick={() => removeRow(a)}
                                    title="Sil"
                                  >
                                    {busy ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </TD>
                            </>
                          )}
                        </TR>
                      );
                    })}

                    {/* Ekleme satırı */}
                    {adding && (
                      <TR className="bg-muted/30">
                        <TD className="text-muted-foreground" colSpan={2}>
                          <Select
                            className="h-8"
                            value={addDraft.projectId}
                            onChange={(e) =>
                              setAddDraft((d) => ({ ...d, projectId: e.target.value }))
                            }
                          >
                            <option value="">Proje seçin…</option>
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </Select>
                        </TD>
                        <TD>
                          <Select
                            className="h-8"
                            value={addDraft.memberId}
                            onChange={(e) =>
                              setAddDraft((d) => ({ ...d, memberId: e.target.value }))
                            }
                          >
                            <option value="">Üye…</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </Select>
                        </TD>
                        <TD>
                          <div className="flex gap-1">
                            <Select
                              className="h-8"
                              value={addDraft.month}
                              onChange={(e) =>
                                setAddDraft((d) => ({ ...d, month: e.target.value }))
                              }
                            >
                              {MONTHS_TR.map((mn, i) => (
                                <option key={mn} value={i + 1}>
                                  {mn}
                                </option>
                              ))}
                            </Select>
                            <Input
                              type="number"
                              className="h-8 w-20"
                              value={addDraft.year}
                              onChange={(e) =>
                                setAddDraft((d) => ({ ...d, year: e.target.value }))
                              }
                            />
                          </div>
                        </TD>
                        <TD className="text-right">
                          <Input
                            type="number"
                            step="0.5"
                            min={0}
                            className="h-8 w-20 text-right tabular-nums"
                            value={addDraft.plannedDays}
                            onChange={(e) =>
                              setAddDraft((d) => ({ ...d, plannedDays: e.target.value }))
                            }
                          />
                        </TD>
                        <TD className="text-right">
                          <Input
                            type="number"
                            step="0.5"
                            min={0}
                            className="h-8 w-20 text-right tabular-nums"
                            value={addDraft.actualDays}
                            onChange={(e) =>
                              setAddDraft((d) => ({ ...d, actualDays: e.target.value }))
                            }
                          />
                        </TD>
                        <TD>
                          <Input
                            className="h-8"
                            placeholder="Kaynak kişiler"
                            value={addDraft.resources}
                            onChange={(e) =>
                              setAddDraft((d) => ({ ...d, resources: e.target.value }))
                            }
                          />
                        </TD>
                        <TD>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-success"
                              disabled={busyId === "__add__"}
                              onClick={saveAdd}
                              title="Ekle"
                            >
                              {busyId === "__add__" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={busyId === "__add__"}
                              onClick={() => {
                                setAdding(false);
                                setAddDraft(emptyAdd);
                              }}
                              title="Vazgeç"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TD>
                      </TR>
                    )}

                    {filtered.length === 0 && !adding && (
                      <TR>
                        <TD colSpan={8} className="py-8 text-center text-muted-foreground">
                          Seçili filtre için kayıt yok
                        </TD>
                      </TR>
                    )}
                  </TBody>
                </Table>

                {!adding && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setError(null);
                        setEditingId(null);
                        setAddDraft({ ...emptyAdd, year: String(year) });
                        setAdding(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Atama Ekle
                    </Button>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
