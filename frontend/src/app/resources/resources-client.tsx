"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Pencil, Trash2, Plus, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import type { AssignmentDTO, MemberDTO } from "@/lib/types";
import { cn, MONTHS_TR, MONTHS_TR_SHORT } from "@/lib/utils";
import { workingDaysByMonth } from "@/lib/workdays";
import { upsertAssignment, deleteAssignment } from "@/app/actions/projects";

type Row = AssignmentDTO & { projectName: string };

type ProjectCells = {
  projectId: string;
  projectCode?: string;
  projectName: string;
  cells: (Row | undefined)[]; // 12 ay
};

export function ResourcesClient({
  assignments,
  members,
  projects,
  isAdmin,
}: {
  assignments: Row[];
  members: MemberDTO[];
  projects: { id: string; name: string }[];
  isAdmin: boolean;
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

  // Üye -> Proje -> Ay kırılımı (saklanabilir panelde gösterilecek)
  const memberProjects = useMemo(() => {
    const map = new Map<string, Map<string, ProjectCells>>();
    members.forEach((m) => map.set(m.id, new Map()));
    filtered.forEach((a) => {
      const projMap = map.get(a.memberId);
      if (!projMap) return;
      let entry = projMap.get(a.projectId);
      if (!entry) {
        entry = {
          projectId: a.projectId,
          projectCode: a.projectCode,
          projectName: a.projectName,
          cells: Array(12).fill(undefined),
        };
        projMap.set(a.projectId, entry);
      }
      entry.cells[a.month - 1] = a;
    });
    return map;
  }, [filtered, members]);

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

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = useCallback((memberId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kaynak Planı</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} kişilik Endüstri 4.0 ekibi için bütünsel kapasite görünümü — {year}
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
            Kapasite, her ay için {year} çalışma günü sayısına göre hesaplanır (hafta
            içi günlerden resmi tatiller ve köprü izinleri düşülür). Kırmızı hücreler
            ilgili ayın kapasitesinin aşımını gösterir. Bir kaynağın altındaki
            projeleri ve aylık atamalarını görmek için satıra tıklayın.
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
                <TH className="text-right">Doluluk</TH>
              </TR>
            </THead>
            <TBody>
              {members.map((m) => {
                const arr = load.get(m.id) ?? [];
                const total = arr.reduce((s, v) => s + v, 0);
                const isOpen = expanded.has(m.id);
                return (
                  <MemberRows
                    key={m.id}
                    member={m}
                    arr={arr}
                    total={total}
                    totalWorkDays={totalWorkDays}
                    isOpen={isOpen}
                    onToggle={() => toggleExpanded(m.id)}
                    cellClass={cellClass}
                    projectsMap={memberProjects.get(m.id) ?? new Map()}
                    projects={projects}
                    year={year}
                    isAdmin={isAdmin}
                  />
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
                {(() => {
                  const teamTotal = members.reduce(
                    (s, m) => s + (load.get(m.id)?.reduce((a, b) => a + b, 0) ?? 0),
                    0
                  );
                  const teamOccupancy = teamCapacityYear > 0 ? teamTotal / teamCapacityYear : 0;
                  return (
                    <>
                      <TD className="text-right font-bold tabular-nums">{teamTotal}</TD>
                      <TD
                        className={cn(
                          "text-right font-bold tabular-nums",
                          teamOccupancy > 1
                            ? "text-destructive"
                            : teamOccupancy > 0.8
                              ? "text-warning"
                              : ""
                        )}
                      >
                        %{Math.round(teamOccupancy * 100)}
                      </TD>
                    </>
                  );
                })()}
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
                <TD className="text-right text-xs font-semibold tabular-nums text-muted-foreground">
                  /kişi
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
    </div>
  );
}

// ── Ekip üyesi satırı + altında saklanabilir proje/atama paneli ─────────
const MemberRows = memo(function MemberRows({
  member,
  arr,
  total,
  totalWorkDays,
  isOpen,
  onToggle,
  cellClass,
  projectsMap,
  projects,
  year,
  isAdmin,
}: {
  member: MemberDTO;
  arr: number[];
  total: number;
  totalWorkDays: number;
  isOpen: boolean;
  onToggle: () => void;
  cellClass: (v: number, monthIndex: number) => string;
  projectsMap: Map<string, ProjectCells>;
  projects: { id: string; name: string }[];
  year: number;
  isAdmin: boolean;
}) {
  const occupancy = totalWorkDays > 0 ? total / totalWorkDays : 0;
  const remaining = totalWorkDays - total;
  return (
    <>
      <TR
        className="cursor-pointer select-none hover:bg-muted/30"
        onClick={onToggle}
      >
        <TD>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              title={isOpen ? "Kapat" : "Atanmış projeleri göster"}
            >
              <ChevronRight
                className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
              />
            </button>
            <div>
              <div className="font-medium">{member.name}</div>
              <div className="text-xs text-muted-foreground">{member.title}</div>
            </div>
          </div>
        </TD>
        {arr.map((v, i) => (
          <TD key={i} className={cn("text-center tabular-nums", cellClass(v, i))}>
            {v > 0 ? v : "·"}
          </TD>
        ))}
        <TD className="text-right font-semibold tabular-nums">{total}</TD>
        <TD
          className={cn(
            "text-right font-semibold tabular-nums",
            occupancy > 1 ? "text-destructive" : occupancy > 0.8 ? "text-warning" : ""
          )}
          title={
            remaining >= 0
              ? `Yıl sonuna kadar ${remaining} adam-gün boşluğu var`
              : `Kapasitenin ${Math.abs(remaining)} adam-gün üzerinde planlanmış`
          }
        >
          %{Math.round(occupancy * 100)}
        </TD>
      </TR>
      {isOpen && (
        <TR>
          <TD colSpan={15} className="bg-muted/20 p-0">
            <MemberProjectsPanel
              member={member}
              projectsMap={projectsMap}
              projects={projects}
              year={year}
              isAdmin={isAdmin}
            />
          </TD>
        </TR>
      )}
    </>
  );
});

// ── Bir kaynağa atanmış projeler ve aylık atama sayıları ─────────
const MemberProjectsPanel = memo(function MemberProjectsPanel({
  member,
  projectsMap,
  projects,
  year,
  isAdmin,
}: {
  member: MemberDTO;
  projectsMap: Map<string, ProjectCells>;
  projects: { id: string; name: string }[];
  year: number;
  isAdmin: boolean;
}) {
  const rows = useMemo(
    () => Array.from(projectsMap.values()).sort((a, b) => a.projectName.localeCompare(b.projectName, "tr")),
    [projectsMap]
  );
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addProjectId, setAddProjectId] = useState("");
  const [addMonth, setAddMonth] = useState(String(new Date().getMonth() + 1));
  const [addDays, setAddDays] = useState("0");

  const assignedProjectIds = useMemo(() => new Set(rows.map((r) => r.projectId)), [rows]);
  const availableProjects = useMemo(
    () => projects.filter((p) => !assignedProjectIds.has(p.id)),
    [projects, assignedProjectIds]
  );

  async function saveCell(row: ProjectCells, monthIndex: number, value: number) {
    const existing = row.cells[monthIndex];
    const key = `${row.projectId}-${monthIndex}`;
    setBusyKey(key);
    setError(null);
    try {
      await upsertAssignment({
        projectId: row.projectId,
        memberId: member.id,
        year,
        month: monthIndex + 1,
        plannedDays: value,
        actualDays: existing?.actualDays ?? 0,
        resources: existing?.resources ?? null,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function removeProject(row: ProjectCells) {
    if (
      !window.confirm(
        `${member.name} için ${row.projectName} projesindeki tüm aylık atamaları silmek istediğinize emin misiniz?`
      )
    )
      return;
    setBusyKey(row.projectId);
    setError(null);
    try {
      const ids = row.cells.filter((c): c is Row => !!c).map((c) => c.id);
      for (const id of ids) {
        await deleteAssignment(id, row.projectId);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function saveAdd() {
    if (!addProjectId) {
      setError("Proje seçmelisiniz.");
      return;
    }
    setBusyKey("__add__");
    setError(null);
    try {
      await upsertAssignment({
        projectId: addProjectId,
        memberId: member.id,
        year,
        month: Number(addMonth) || 1,
        plannedDays: Number(addDays) || 0,
        actualDays: 0,
        resources: null,
      });
      setAdding(false);
      setAddProjectId("");
      setAddDays("0");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">
          {member.name} — atanmış projeler ve aylık atama gün sayıları
        </p>
        {!isAdmin && (
          <span className="text-xs text-muted-foreground">Yalnızca görüntüleme</span>
        )}
      </div>
      {error && (
        <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {rows.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">
          {year} yılı için {member.name} adına atanmış proje bulunmuyor.
        </p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Proje</TH>
              {MONTHS_TR_SHORT.map((m) => (
                <TH key={m} className="text-center">
                  {m}
                </TH>
              ))}
              <TH className="text-right">Toplam</TH>
              {isAdmin && <TH className="text-right">İşlem</TH>}
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <ProjectRow
                key={row.projectId}
                row={row}
                isAdmin={isAdmin}
                busyKey={busyKey}
                onSaveCell={saveCell}
                onRemove={removeProject}
              />
            ))}
          </TBody>
        </Table>
      )}

      {isAdmin && (
        <div className="mt-3">
          {adding ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
              <Select
                className="h-8 w-56"
                value={addProjectId}
                onChange={(e) => setAddProjectId(e.target.value)}
              >
                <option value="">Proje seçin…</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Select
                className="h-8 w-28"
                value={addMonth}
                onChange={(e) => setAddMonth(e.target.value)}
              >
                {MONTHS_TR.map((mn, i) => (
                  <option key={mn} value={i + 1}>
                    {mn}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                step="0.5"
                min={0}
                className="h-8 w-24 text-right tabular-nums"
                value={addDays}
                onChange={(e) => setAddDays(e.target.value)}
                placeholder="Gün"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-success"
                disabled={busyKey === "__add__"}
                onClick={saveAdd}
                title="Ekle"
              >
                {busyKey === "__add__" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={busyKey === "__add__"}
                onClick={() => {
                  setAdding(false);
                  setAddProjectId("");
                  setAddDays("0");
                }}
                title="Vazgeç"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" />
              Proje Ata
            </Button>
          )}
        </div>
      )}
    </div>
  );
});

// ── Proje satırı: aylık hücreler admin için düzenlenebilir ─────────
const ProjectRow = memo(function ProjectRow({
  row,
  isAdmin,
  busyKey,
  onSaveCell,
  onRemove,
}: {
  row: ProjectCells;
  isAdmin: boolean;
  busyKey: string | null;
  onSaveCell: (row: ProjectCells, monthIndex: number, value: number) => void;
  onRemove: (row: ProjectCells) => void;
}) {
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const total = row.cells.reduce((s, c) => s + (c?.plannedDays ?? 0), 0);

  return (
    <TR>
      <TD>
        <Link
          href={`/projects/${row.projectId}`}
          className="font-medium text-primary hover:underline"
        >
          {row.projectName}
        </Link>
      </TD>
      {row.cells.map((c, i) => {
        const value = c?.plannedDays ?? 0;
        const key = `${row.projectId}-${i}`;
        const isBusy = busyKey === key;
        if (isAdmin && editingMonth === i) {
          return (
            <TD key={i} className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Input
                  type="number"
                  step="0.5"
                  min={0}
                  autoFocus
                  className="h-7 w-16 text-right tabular-nums"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-success"
                  disabled={isBusy}
                  onClick={() => {
                    onSaveCell(row, i, Number(draft) || 0);
                    setEditingMonth(null);
                  }}
                  title="Kaydet"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={isBusy}
                  onClick={() => setEditingMonth(null)}
                  title="Vazgeç"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TD>
          );
        }
        return (
          <TD
            key={i}
            className={cn(
              "text-center tabular-nums",
              value > 0 ? "" : "text-muted-foreground/40",
              isAdmin && "cursor-pointer hover:bg-muted/50"
            )}
            onClick={
              isAdmin
                ? () => {
                    setDraft(String(value));
                    setEditingMonth(i);
                  }
                : undefined
            }
          >
            {value > 0 ? value : "·"}
          </TD>
        );
      })}
      <TD className="text-right font-semibold tabular-nums">{total}</TD>
      {isAdmin && (
        <TD className="text-right">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            disabled={busyKey === row.projectId}
            onClick={() => onRemove(row)}
            title="Projeden kaldır"
          >
            {busyKey === row.projectId ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </TD>
      )}
    </TR>
  );
});
