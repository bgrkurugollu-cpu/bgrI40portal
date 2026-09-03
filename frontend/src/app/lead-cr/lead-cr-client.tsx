"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ArrowUpRight, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useSort, SortTH, type SortValue } from "@/components/ui/sortable";
import { Card } from "@/components/ui/card";
import { ProjectForm } from "../projects/project-form";
import { deleteProject } from "@/app/actions/projects";
import type { FactoryDTO, ProjectDTO } from "@/lib/types";
import { formatMoney, formatDate, STATUS_LABELS } from "@/lib/utils";

const KIND_LABELS: Record<string, string> = { LEAD: "Lead", CR: "CR" };
const kindTone = (k: string) => (k === "CR" ? "warning" : "info");

const statusTone = (s: string) =>
  s === "ACTIVE"
    ? "success"
    : s === "PLANNED"
      ? "info"
      : s === "COMPLETED"
        ? "muted"
        : s === "ON_HOLD"
          ? "warning"
          : "destructive";

const STATUS_RANK: Record<string, number> = {
  ACTIVE: 1,
  PLANNED: 2,
  ON_HOLD: 3,
  CANCELLED: 4,
  COMPLETED: 5,
};

function itemValue(p: ProjectDTO, key: string): SortValue {
  switch (key) {
    case "kind":
      return p.kind;
    case "code":
      return p.projectCode;
    case "pipelineCode":
      return p.pipelineCode ?? "";
    case "name":
      return p.name;
    case "factory":
      return p.factoryNames.join(", ");
    case "budget":
      return p.targetBudget;
    case "timeline":
      return p.startDate;
    case "status":
      return STATUS_RANK[p.status] ?? 0;
    default:
      return null;
  }
}

export function LeadCrClient({
  items,
  factories,
}: {
  items: ProjectDTO[];
  factories: FactoryDTO[];
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProjectDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return items;
    return items.filter(
      (p) =>
        p.projectCode.toLocaleLowerCase("tr").includes(q) ||
        (p.pipelineCode ?? "").toLocaleLowerCase("tr").includes(q) ||
        p.name.toLocaleLowerCase("tr").includes(q) ||
        p.factoryNames.join(", ").toLocaleLowerCase("tr").includes(q)
    );
  }, [items, query]);

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, itemValue, {
    key: "status",
  });

  async function onDelete(p: ProjectDTO) {
    if (
      !window.confirm(
        `"${p.name}" kaydını ve tüm ilişkili verilerini (atama, bütçe, finans, fatura) kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
      )
    )
      return;
    setDeletingId(p.id);
    try {
      await deleteProject(p.id);
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lead / CR</h1>
          <p className="text-sm text-muted-foreground">
            Proje veya demand kapsamı dışındaki işler — Lead ve CR kayıtları
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Yeni Lead / CR
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Kod, isim veya fabrika ara…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        <Table>
          <THead>
            <TR>
              <SortTH label="Tür" col="kind" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="Kodu" col="code" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="Pipeline Kodu (PTM)" col="pipelineCode" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="İsim" col="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="Fabrika" col="factory" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="Hedef Bütçe" col="budget" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="Zaman Çizelgesi" col="timeline" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="Durum" col="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {sorted.map((p) => (
              <TR
                key={p.id}
                className={
                  p.status === "COMPLETED"
                    ? "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
                    : p.status === "CANCELLED"
                      ? "bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50"
                      : undefined
                }
              >
                <TD>
                  <Badge tone={kindTone(p.kind)}>{KIND_LABELS[p.kind] ?? p.kind}</Badge>
                </TD>
                <TD className="font-mono text-xs font-bold text-muted-foreground">
                  {p.projectCode}
                </TD>
                <TD className="font-mono text-xs text-muted-foreground">
                  {p.pipelineCode || "—"}
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
                <TD className="text-muted-foreground">{p.factoryNames.join(", ")}</TD>
                <TD className="font-medium">{formatMoney(p.targetBudget, "TRY", 2)}</TD>
                <TD className="text-muted-foreground">
                  {formatDate(p.startDate)} → {formatDate(p.endDate)}
                </TD>
                <TD>
                  <Badge tone={statusTone(p.status)}>{STATUS_LABELS[p.status]}</Badge>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(p)}
                      aria-label="Düzenle"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      disabled={deletingId === p.id}
                      onClick={() => onDelete(p)}
                      aria-label="Sil"
                    >
                      {deletingId === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
            {sorted.length === 0 && (
              <TR>
                <TD colSpan={9} className="py-10 text-center text-muted-foreground">
                  {query.trim()
                    ? "Aramanızla eşleşen kayıt bulunamadı."
                    : "Henüz Lead/CR kaydı yok. “Yeni Lead / CR” ile başlayın."}
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Yeni Lead / CR" wide>
        <ProjectForm factories={factories} defaultKind="LEAD" onDone={() => setCreating(false)} />
      </Dialog>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Lead / CR Düzenle" wide>
        {editing && (
          <ProjectForm
            factories={factories}
            project={editing}
            defaultKind="LEAD"
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
