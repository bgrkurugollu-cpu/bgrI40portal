"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import type { AssignmentDTO, MemberDTO } from "@/lib/types";
import { cn, MONTHS_TR_SHORT } from "@/lib/utils";

// Ayda ~21 iş günü kapasite varsayımı
const MONTHLY_CAPACITY = 21;

type Row = AssignmentDTO & { projectName: string };

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

  const teamCapacity = members.length * MONTHLY_CAPACITY;

  const cellClass = (v: number) => {
    if (v === 0) return "text-muted-foreground/40";
    const ratio = v / MONTHLY_CAPACITY;
    if (ratio > 1) return "bg-destructive/15 font-semibold text-destructive";
    if (ratio > 0.8) return "bg-warning/20 font-medium";
    return "bg-success/10";
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kaynak Planı</h1>
          <p className="text-sm text-muted-foreground">
            6 kişilik Endüstri 4.0 ekibi için bütünsel kapasite görünümü — {year}
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
            Aylık kapasite varsayımı: kişi başı {MONTHLY_CAPACITY} iş günü. Kırmızı hücreler
            kapasite aşımını gösterir.
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
                      <TD key={i} className={cn("text-center tabular-nums", cellClass(v))}>
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
            </TBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Ekip aylık toplam kapasitesi: {teamCapacity} adam-gün
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

      <Card>
        <CardHeader>
          <CardTitle>Atama Detayları</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Proje</TH>
                <TH>Ekip Üyesi</TH>
                <TH>Dönem</TH>
                <TH className="text-right">Plan</TH>
                <TH className="text-right">Gerçekleşen</TH>
                <TH>Kaynaklar</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((a) => (
                <TR key={a.id}>
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
                  <TD className="text-right tabular-nums">{a.plannedDays}</TD>
                  <TD className="text-right tabular-nums">{a.actualDays}</TD>
                  <TD className="text-muted-foreground">{a.resources ?? "—"}</TD>
                </TR>
              ))}
              {filtered.length === 0 && (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                    Bu yıl için atama bulunamadı.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
