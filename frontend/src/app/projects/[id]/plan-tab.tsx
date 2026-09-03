"use client";

import { useEffect, useMemo, useState, type FormEvent, type CSSProperties } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Diamond,
  Users,
  Loader2,
  ExternalLink,
  Link2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  createTask,
  updateTask,
  deleteTask,
  setTaskAssignees,
  upsertWeekAllocation,
  updateTaskJira,
} from "@/app/actions/tasks";
import type { MemberDTO, ProjectDTO, ProjectTaskDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { weekColumnsForYear, weekRangeInYear, daysBetweenInclusive } from "@/lib/isoweek";
import { exportProjectPlanToExcel } from "@/lib/gantt-export";

const TASK_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

const TASK_TYPE_LABELS: Record<string, string> = { TASK: "Alt Görev", MILESTONE: "Ana Görev" };

const COL_WIDTHS = [260, 90, 96, 96, 70, 180, 170];
const COL_OFFSETS = COL_WIDTHS.reduce<number[]>((acc, w, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + COL_WIDTHS[i - 1]);
  return acc;
}, []);
const WEEK_COL_WIDTH = 30;

function stickyStyle(colIndex: number): CSSProperties {
  return {
    position: "sticky",
    left: COL_OFFSETS[colIndex],
    width: COL_WIDTHS[colIndex],
    minWidth: COL_WIDTHS[colIndex],
    maxWidth: COL_WIDTHS[colIndex],
    zIndex: colIndex === COL_WIDTHS.length - 1 ? 11 : 10,
  };
}

type TaskNode = ProjectTaskDTO & { children: TaskNode[]; depth: number };

function buildTree(tasks: ProjectTaskDTO[]): TaskNode[] {
  const map = new Map<string, TaskNode>();
  tasks.forEach((t) => map.set(t.id, { ...t, children: [], depth: 0 }));
  const roots: TaskNode[] = [];
  map.forEach((node) => {
    const parent = node.parentId ? map.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  function assignDepth(nodes: TaskNode[], depth: number) {
    for (const n of nodes) {
      n.depth = depth;
      assignDepth(n.children, depth + 1);
    }
  }
  assignDepth(roots, 0);
  return roots;
}

function flattenVisible(nodes: TaskNode[], expanded: Set<string>): TaskNode[] {
  const out: TaskNode[] = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children.length && expanded.has(n.id)) out.push(...flattenVisible(n.children, expanded));
  }
  return out;
}

function monthGroups(weekCols: { week: number; monthLabel: string | null }[]) {
  const groups: { label: string; span: number }[] = [];
  for (const c of weekCols) {
    if (c.monthLabel) groups.push({ label: c.monthLabel, span: 1 });
    else if (groups.length) groups[groups.length - 1].span++;
    else groups.push({ label: "", span: 1 });
  }
  return groups;
}

export function ProjectPlanTab({
  project,
  tasks,
  members,
  isSuperAdmin,
}: {
  project: ProjectDTO;
  tasks: ProjectTaskDTO[];
  members: MemberDTO[];
  isSuperAdmin: boolean;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(tasks.map((t) => t.id)));
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTaskDTO | null>(null);
  const [newTaskParentId, setNewTaskParentId] = useState<string | null>(null);
  const [assigneeTask, setAssigneeTask] = useState<ProjectTaskDTO | null>(null);

  const tree = useMemo(() => buildTree(tasks), [tasks]);
  const visible = useMemo(() => flattenVisible(tree, expanded), [tree, expanded]);
  const weekCols = useMemo(() => weekColumnsForYear(year), [year]);
  const groups = useMemo(() => monthGroups(weekCols), [weekCols]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAddTask(parentId: string | null) {
    setEditingTask(null);
    setNewTaskParentId(parentId);
    setTaskDialogOpen(true);
  }

  function openEditTask(t: ProjectTaskDTO) {
    setEditingTask(t);
    setNewTaskParentId(t.parentId);
    setTaskDialogOpen(true);
  }

  async function onDeleteTask(t: ProjectTaskDTO) {
    if (
      !window.confirm(
        `"${t.title}" görevini${t.type === "TASK" ? " (varsa alt görevleriyle birlikte)" : ""} silmek istediğinize emin misiniz?`
      )
    )
      return;
    await deleteTask(t.id);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Proje Planı</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>
            ← {year - 1}
          </Button>
          <span className="px-1 text-sm font-semibold">{year}</span>
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)}>
            {year + 1} →
          </Button>
          <Button size="sm" onClick={() => openAddTask(null)}>
            <Plus className="h-4 w-4" /> Ana Görev Ekle
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportProjectPlanToExcel(
                { projectCode: project.projectCode, name: project.name },
                tasks,
                year
              )
            }
          >
            <Download className="h-4 w-4" /> Excel&apos;e Dışa Aktar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t bg-accent/40 px-4 py-2 text-xs text-muted-foreground">
          Haftalık kutulara kişi başına gün sayısı girildiğinde, ilgili ayın Kaynak Planı&apos;ndaki
          planlanan efor otomatik güncellenir.
        </div>
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm" style={{ minWidth: "100%" }}>
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-20 border-b bg-card"
                  style={{ width: COL_OFFSETS[COL_WIDTHS.length - 1] + COL_WIDTHS[COL_WIDTHS.length - 1] }}
                  colSpan={7}
                ></th>
                {groups.map((g, i) => (
                  <th
                    key={i}
                    colSpan={g.span}
                    className="border-b border-l bg-card px-1 py-1 text-center text-[10px] font-semibold whitespace-nowrap text-muted-foreground"
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky border-b bg-card px-3 py-2 text-left text-xs font-semibold" style={stickyStyle(0)}>
                  Başlık
                </th>
                <th className="sticky border-b bg-card px-2 py-2 text-left text-xs font-semibold" style={stickyStyle(1)}>
                  Tip
                </th>
                <th className="sticky border-b bg-card px-2 py-2 text-left text-xs font-semibold" style={stickyStyle(2)}>
                  Başlangıç
                </th>
                <th className="sticky border-b bg-card px-2 py-2 text-left text-xs font-semibold" style={stickyStyle(3)}>
                  Bitiş
                </th>
                <th className="sticky border-b bg-card px-2 py-2 text-left text-xs font-semibold" style={stickyStyle(4)}>
                  Süre
                </th>
                <th
                  className="sticky border-b bg-card px-2 py-2 text-left text-xs font-semibold"
                  style={stickyStyle(5)}
                >
                  Atananlar
                </th>
                <th
                  className="sticky border-r-2 border-b bg-card px-2 py-2 text-left text-xs font-semibold"
                  style={stickyStyle(6)}
                >
                  JIRA Kodu
                </th>
                {weekCols.map((c) => (
                  <th
                    key={c.week}
                    className="border-b border-l bg-card text-center text-[10px] font-medium text-muted-foreground"
                    style={{ width: WEEK_COL_WIDTH, minWidth: WEEK_COL_WIDTH }}
                  >
                    {c.week}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <TaskRows
                  key={t.id}
                  task={t}
                  expanded={expanded}
                  onToggleExpand={toggleExpand}
                  weekCols={weekCols}
                  year={year}
                  onAddSubtask={() => openAddTask(t.id)}
                  onEdit={() => openEditTask(t)}
                  onDelete={() => onDeleteTask(t)}
                  onManageAssignees={() => setAssigneeTask(t)}
                  isSuperAdmin={isSuperAdmin}
                />
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7 + weekCols.length} className="py-10 text-center text-muted-foreground">
                    Henüz ana görev yok. &quot;Ana Görev Ekle&quot; ile başlayın.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        title={
          editingTask
            ? `${TASK_TYPE_LABELS[editingTask.type]} Düzenle`
            : newTaskParentId
              ? "Yeni Alt Görev"
              : "Yeni Ana Görev"
        }
      >
        <TaskForm
          projectId={project.id}
          parentId={newTaskParentId}
          task={editingTask}
          onDone={() => setTaskDialogOpen(false)}
        />
      </Dialog>

      <Dialog
        open={!!assigneeTask}
        onClose={() => setAssigneeTask(null)}
        title={assigneeTask ? `Atananlar — ${assigneeTask.title}` : "Atananlar"}
      >
        {assigneeTask && (
          <AssigneeForm task={assigneeTask} members={members} onDone={() => setAssigneeTask(null)} />
        )}
      </Dialog>
    </Card>
  );
}

function TaskRows({
  task,
  expanded,
  onToggleExpand,
  weekCols,
  year,
  onAddSubtask,
  onEdit,
  onDelete,
  onManageAssignees,
  isSuperAdmin,
}: {
  task: TaskNode;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  weekCols: { week: number; monthLabel: string | null }[];
  year: number;
  onAddSubtask: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onManageAssignees: () => void;
  isSuperAdmin: boolean;
}) {
  const range = weekRangeInYear(task.startDate, task.endDate, year);
  const duration = daysBetweenInclusive(task.startDate, task.endDate);
  const isMilestone = task.type === "MILESTONE";

  return (
    <>
      <tr className="group hover:bg-accent/30">
        <td className="sticky border-b bg-card px-3 py-1.5" style={stickyStyle(0)}>
          <div className="flex items-center gap-1" style={{ paddingLeft: task.depth * 16 }}>
            {task.children.length > 0 ? (
              <button onClick={() => onToggleExpand(task.id)} className="shrink-0 text-muted-foreground hover:text-foreground">
                {expanded.has(task.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="inline-block w-3.5" />
            )}
            {isMilestone ? (
              <Diamond className="h-3 w-3 shrink-0" style={{ color: task.color }} fill={task.color} />
            ) : (
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: task.color }} />
            )}
            <span className="truncate font-medium" title={task.title}>
              {task.title}
            </span>
            <div className="ml-auto hidden shrink-0 items-center gap-0.5 group-hover:flex">
              {isMilestone && (
                <button onClick={onAddSubtask} title="Bu ana göreve alt görev ekle" className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={onEdit} title="Düzenle" className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={onDelete} title="Sil" className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </td>
        <td className="sticky border-b bg-card px-2 py-1.5" style={stickyStyle(1)}>
          <Badge tone={isMilestone ? "warning" : "info"}>{TASK_TYPE_LABELS[task.type]}</Badge>
        </td>
        <td className="sticky border-b bg-card px-2 py-1.5 text-xs text-muted-foreground whitespace-nowrap" style={stickyStyle(2)}>
          {task.startDate}
        </td>
        <td className="sticky border-b bg-card px-2 py-1.5 text-xs text-muted-foreground whitespace-nowrap" style={stickyStyle(3)}>
          {task.endDate}
        </td>
        <td className="sticky border-b bg-card px-2 py-1.5 text-xs text-muted-foreground whitespace-nowrap" style={stickyStyle(4)}>
          {duration} gün
        </td>
        <td className="sticky border-b bg-card px-2 py-1.5" style={stickyStyle(5)}>
          <button
            onClick={onManageAssignees}
            className="flex items-center gap-1 truncate text-xs text-primary hover:underline"
            title="Atananları yönet"
          >
            <Users className="h-3 w-3 shrink-0" />
            {task.assignees.length > 0 ? task.assignees.map((a) => a.memberName).join(", ") : "Ata…"}
          </button>
        </td>
        <td className="sticky border-r-2 border-b bg-card px-2 py-1.5" style={stickyStyle(6)}>
          <JiraCell task={task} isSuperAdmin={isSuperAdmin} />
        </td>
        {weekCols.map((c) => {
          const inRange = range && c.week >= range.startWeek && c.week <= range.endWeek;
          return (
            <td key={c.week} className="border-b border-l p-0" style={{ width: WEEK_COL_WIDTH, minWidth: WEEK_COL_WIDTH }}>
              {inRange &&
                (isMilestone ? (
                  <div
                    className="mx-0.5 h-5 rounded-sm border-2 border-dashed border-foreground/50"
                    style={{ backgroundColor: `${task.color}55` }}
                    title={`${task.title} (Ana Görev: ${task.startDate} → ${task.endDate})`}
                  />
                ) : (
                  <div className="mx-0.5 h-5 rounded-sm" style={{ backgroundColor: task.color }} />
                ))}
            </td>
          );
        })}
      </tr>
      {!isMilestone &&
        task.assignees.map((a) => (
          <tr key={a.id} className="hover:bg-accent/20">
            <td className="sticky border-b bg-card px-3 py-1" style={stickyStyle(0)}>
              <div className="flex items-center gap-1 text-xs text-muted-foreground" style={{ paddingLeft: task.depth * 16 + 18 }}>
                <span className="truncate">↳ {a.memberName}</span>
              </div>
            </td>
            <td className="sticky border-b bg-card" style={stickyStyle(1)}></td>
            <td className="sticky border-b bg-card" style={stickyStyle(2)}></td>
            <td className="sticky border-b bg-card" style={stickyStyle(3)}></td>
            <td className="sticky border-b bg-card" style={stickyStyle(4)}></td>
            <td className="sticky border-b bg-card" style={stickyStyle(5)}></td>
            <td className="sticky border-r-2 border-b bg-card" style={stickyStyle(6)}></td>
            {weekCols.map((c) => {
              const inRange = range && c.week >= range.startWeek && c.week <= range.endWeek;
              const key = `${year}-${c.week}`;
              return (
                <td
                  key={c.week}
                  className="border-b border-l p-0 text-center"
                  style={{ width: WEEK_COL_WIDTH, minWidth: WEEK_COL_WIDTH }}
                >
                  {inRange ? (
                    <WeekDayInput
                      taskAssigneeId={a.id}
                      year={year}
                      week={c.week}
                      value={a.weekAllocations[key] ?? 0}
                    />
                  ) : (
                    <div className="h-6" />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
    </>
  );
}

function JiraCell({ task, isSuperAdmin }: { task: ProjectTaskDTO; isSuperAdmin: boolean }) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(task.jiraCode ?? "");
  const [link, setLink] = useState(task.jiraLink ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCode(task.jiraCode ?? "");
    setLink(task.jiraLink ?? "");
  }, [task.jiraCode, task.jiraLink]);

  async function save() {
    setSaving(true);
    try {
      await updateTaskJira(task.id, { jiraCode: code || null, jiraLink: link || null });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1 py-0.5">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Kod (örn. PRJ-42)"
          className="h-6 text-xs"
        />
        <Input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="JIRA linki"
          className="h-6 text-xs"
        />
        <div className="flex items-center gap-1">
          <Button size="sm" className="h-6 px-2 text-xs" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Kaydet"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => {
              setCode(task.jiraCode ?? "");
              setLink(task.jiraLink ?? "");
              setEditing(false);
            }}
            disabled={saving}
          >
            Vazgeç
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/jira flex items-center gap-1">
      {task.jiraCode ? (
        task.jiraLink ? (
          <a
            href={task.jiraLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 truncate text-xs text-primary hover:underline"
            title="JIRA'da aç"
          >
            <Link2 className="h-3 w-3 shrink-0" />
            {task.jiraCode}
            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
          </a>
        ) : (
          <span className="truncate text-xs text-muted-foreground">{task.jiraCode}</span>
        )
      ) : (
        <span className="text-xs text-muted-foreground/40">—</span>
      )}
      {isSuperAdmin && (
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover/jira:opacity-100"
          title="JIRA kodu/linkini düzenle"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function WeekDayInput({
  taskAssigneeId,
  year,
  week,
  value,
}: {
  taskAssigneeId: string;
  year: number;
  week: number;
  value: number;
}) {
  const [v, setV] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => setV(value), [value]);

  async function save() {
    if (v === value) return;
    setSaving(true);
    await upsertWeekAllocation({ taskAssigneeId, year, week, days: v || 0 });
    setSaving(false);
  }

  return (
    <input
      type="number"
      min={0}
      step="0.5"
      value={v || ""}
      onChange={(e) => setV(Number(e.target.value))}
      onBlur={save}
      className={cn(
        "h-6 w-full border-0 bg-transparent text-center text-[11px] outline-none focus:bg-accent",
        saving && "opacity-50"
      )}
    />
  );
}

function TaskForm({
  projectId,
  parentId,
  task,
  onDone,
}: {
  projectId: string;
  parentId: string | null;
  task: ProjectTaskDTO | null;
  onDone: () => void;
}) {
  // Hiyerarşi kuralı: Ana Görev (DB: MILESTONE) üst düzeydedir, Alt Görev
  // (DB: TASK) bir ana görevin altındadır. Yeni kayıt oluştururken tip buna
  // göre sabitlenir; mevcut bir kaydı düzenlerken (geriye dönük veri için)
  // serbest bırakılır.
  const lockedType = !task ? (parentId ? "TASK" : "MILESTONE") : null;

  const [loading, setLoading] = useState(false);
  const [color, setColor] = useState(task?.color ?? TASK_COLORS[0]);
  const [type, setType] = useState(task?.type ?? lockedType ?? "TASK");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const startDate = String(fd.get("startDate"));
    const endDate = String(fd.get("endDate")) || startDate;
    const input = {
      title: String(fd.get("title")),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      color,
      startDate,
      endDate: endDate < startDate ? startDate : endDate,
    };
    try {
      if (task) {
        await updateTask(task.id, input);
      } else {
        await createTask({ projectId, parentId, ...input });
      }
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {!task && parentId && (
        <p className="rounded-lg bg-accent/50 px-3 py-2 text-xs text-muted-foreground">
          Bu, seçili ana görevin altına bir <strong>Alt Görev</strong> olarak eklenecek.
        </p>
      )}
      {!task && !parentId && (
        <p className="rounded-lg bg-accent/50 px-3 py-2 text-xs text-muted-foreground">
          Üst düzeyde eklenen kayıtlar <strong>Ana Görev</strong>&apos;dir — alt görevlerini
          satırdaki + ikonuyla ekleyebilirsiniz.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="title">Başlık</Label>
          <Input id="title" name="title" defaultValue={task?.title} required />
        </div>
        <div>
          <Label htmlFor="type">Tip</Label>
          {lockedType ? (
            <Select id="type" disabled value={lockedType} onChange={() => {}}>
              <option value={lockedType}>{TASK_TYPE_LABELS[lockedType]}</option>
            </Select>
          ) : (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as any)}>
              {Object.entries(TASK_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div>
          <Label>Renk</Label>
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
            {TASK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition-transform",
                  color === c ? "scale-110 border-foreground" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="startDate">Başlangıç</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={task?.startDate} required />
        </div>
        <div>
          <Label htmlFor="endDate">Bitiş</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={task?.endDate ?? ""}
            placeholder={type === "MILESTONE" ? "Boş bırakılırsa başlangıçla aynı" : undefined}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Vazgeç
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {task ? "Kaydet" : "Ekle"}
        </Button>
      </div>
    </form>
  );
}

function AssigneeForm({
  task,
  members,
  onDone,
}: {
  task: ProjectTaskDTO;
  members: MemberDTO[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(task.assignees.map((a) => a.memberId));
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      await setTaskAssignees(task.id, selected);
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Ekip Üyeleri</Label>
        <MultiSelect
          options={members.map((m) => ({ value: m.id, label: m.name }))}
          selected={selected}
          onChange={setSelected}
          placeholder="Kişi seçin"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Bir kişiyi kaldırmak, o kişinin bu görev için girdiği haftalık gün verilerini de siler ve
        Kaynak Planı&apos;ndaki ilgili ayları yeniden hesaplar.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Vazgeç
        </Button>
        <Button type="button" onClick={save} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Kaydet
        </Button>
      </div>
    </div>
  );
}
