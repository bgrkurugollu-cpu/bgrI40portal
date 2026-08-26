"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ArrowUpRight, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { PtForm } from "./pt-form";
import { deletePt } from "@/app/actions/pt";
import type { PtDTO } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/utils";

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

export function PtClient({ items }: { items: PtDTO[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PtDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return items;
    return items.filter(
      (p) =>
        p.ptCode.toLocaleLowerCase("tr").includes(q) ||
        (p.pipelineCode ?? "").toLocaleLowerCase("tr").includes(q) ||
        p.name.toLocaleLowerCase("tr").includes(q)
    );
  }, [items, query]);

  async function onDelete(p: PtDTO) {
    if (
      !window.confirm(
        `"${p.name}" PT kaydını ve tüm ilişkili verilerini (fatura, aylık finans) kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
      )
    )
      return;
    setDeletingId(p.id);
    try {
      await deletePt(p.id);
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
          <h1 className="text-2xl font-bold">PT Kodları</h1>
          <p className="text-sm text-muted-foreground">
            PT karşılığı alınan faturalar ve aylık finans (gider + %5 gelir) takibi
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Yeni PT
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="PT kodu veya isim ara…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Kodu</TH>
              <TH>Pipeline Kodu (PTM)</TH>
              <TH>PT Adı</TH>
              <TH>Açıklama</TH>
              <TH>Durum</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((p) => (
              <TR key={p.id}>
                <TD className="font-mono text-xs font-bold text-muted-foreground">{p.ptCode}</TD>
                <TD className="font-mono text-xs text-muted-foreground">{p.pipelineCode || "—"}</TD>
                <TD>
                  <Link
                    href={`/pt/${p.id}`}
                    className="group inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    {p.name}
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </TD>
                <TD className="text-muted-foreground">{p.description || "—"}</TD>
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
            {filtered.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-10 text-center text-muted-foreground">
                  {query.trim() ? "Aramanızla eşleşen PT bulunamadı." : "Henüz PT yok. “Yeni PT” ile başlayın."}
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Yeni PT">
        <PtForm onDone={() => setCreating(false)} />
      </Dialog>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title="PT Düzenle">
        {editing && <PtForm pt={editing} onDone={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}
