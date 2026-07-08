"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Pencil, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { ProjectForm } from "./project-form";
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

export function ProjectsClient({
  projects,
  factories,
}: {
  projects: ProjectDTO[];
  factories: FactoryDTO[];
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProjectDTO | null>(null);

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

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Proje</TH>
              <TH>Fabrika</TH>
              <TH>İhtimal</TH>
              <TH>Hedef Bütçe</TH>
              <TH>Zaman Çizelgesi</TH>
              <TH>Risk</TH>
              <TH>Öncelik</TH>
              <TH>Durum</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {projects.map((p) => (
              <TR key={p.id}>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(p)}
                    aria-label="Düzenle"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TD>
              </TR>
            ))}
            {projects.length === 0 && (
              <TR>
                <TD colSpan={9} className="py-10 text-center text-muted-foreground">
                  Henüz proje yok. &quot;Yeni Proje&quot; ile başlayın.
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
