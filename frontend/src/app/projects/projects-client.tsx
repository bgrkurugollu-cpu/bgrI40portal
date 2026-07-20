"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, ArrowUpRight, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useSort, SortTH, type SortValue } from "@/components/ui/sortable";
import { Card } from "@/components/ui/card";
import { ProjectForm } from "./project-form";
import { deleteProject } from "@/app/actions/projects";
import type { FactoryDTO, ProjectDTO } from "@/lib/types";
import { formatMoney, formatDate, RISK_LABELS, STATUS_LABELS } from "@/lib/utils";

const riskTone = (r: string) =>
  r === "LOW" ? "success" : r === "MEDIUM" ? "warning" : "destructive";
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

// Risk/Öncelik için mantıksal sıralama (alfabetik değil).
const LEVEL_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

function projectValue(p: ProjectDTO, key: string): SortValue {
  switch (key) {
    case "code":
      return p.projectCode;
    case "name":
      return p.name;
    case "factory":
      return p.factoryNames.join(", ");
    case "probability":
      return p.probability;
    case "budget":
      return p.targetBudget;
    case "timeline":
      return p.startDate;
    case "risk":
      return LEVEL_RANK[p.riskLevel] ?? 0;
    case "priority":
      return LEVEL_RANK[p.priority] ?? 0;
    case "status":
      return STATUS_LABELS[p.status] ?? p.status;
    default:
      return null;
  }
}

export function ProjectsClient({
  projects,
  factories,
}: {
  projects: ProjectDTO[];
  factories: FactoryDTO[];
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProjectDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const q = query.trim().toLocaleLowerCase("tr");
  const filtered = q
    ? projects.filter(
        (p) =>
          p.projectCode.toLocaleLowerCase("tr").includes(q) ||
          p.name.toLocaleLowerCase("tr").includes(q) ||
          p.factoryNames.join(", ").toLocaleLowerCase("tr").includes(q)
      )
    : projects;

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, projectValue);

  async function onDelete(p: ProjectDTO) {
    if (
      !window.confirm(
        `"${p.name}" projesini ve tüm ilişkili verilerini (atama, bütçe, finans, fatura) kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projeler</h1>
          <p className="text-sm text-muted-foreground">
            Fabrikalarda yürütülen projelerin kayıtları ve tarihsel takibi
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Yeni Proje
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Proje kodu, isim veya fabrika ara…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        <Table>
          <THead>
            <TR>
              <SortTH label="Kodu" col="code" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="Proje İsmi" col="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="Fabrika" col="factory" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="İhtimal" col="probability" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="Hedef Bütçe" col="budget" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="Zaman Çizelgesi" col="timeline" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="Risk" col="risk" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="Öncelik" col="priority" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTH label="Durum" col="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {sorted.map((p) => (
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
                <TD className="text-muted-foreground">{p.factoryNames.join(", ")}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${p.probability}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      %{p.probability}
                    </span>
                  </div>
                </TD>
                <TD className="font-medium">{formatMoney(p.targetBudget)}</TD>
                <TD className="text-muted-foreground">
                  {formatDate(p.startDate)} → {formatDate(p.endDate)}
                </TD>
                <TD>
                  <Badge tone={riskTone(p.riskLevel)}>{RISK_LABELS[p.riskLevel]}</Badge>
                </TD>
                <TD>
                  <Badge tone={riskTone(p.priority)}>{RISK_LABELS[p.priority]}</Badge>
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
                <TD colSpan={10} className="py-10 text-center text-muted-foreground">
                  {q
                    ? "Aramanızla eşleşen proje bulunamadı."
                    : "Henüz proje yok. “Yeni Proje” ile başlayın."}
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Yeni Proje"
        wide
      >
        <ProjectForm factories={factories} onDone={() => setCreating(false)} />
      </Dialog>
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Projeyi Düzenle"
        wide
      >
        {editing && (
          <ProjectForm
            factories={factories}
            project={editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </motion.div>
  );
}
