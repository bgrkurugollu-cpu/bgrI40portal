"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePageEdit } from "@/lib/permission-guard";
import type { TaskType } from "@prisma/client";
import { isoWeekMonday } from "@/lib/isoweek";

// ── Görev / Milestone CRUD ──────────────────────────────

export async function createTask(input: {
  projectId: string;
  parentId?: string | null;
  title: string;
  type: TaskType;
  color: string;
  startDate: string;
  endDate: string;
  order?: number;
}) {
  await requirePageEdit("projects");

  const task = await prisma.projectTask.create({
    data: {
      projectId: input.projectId,
      parentId: input.parentId ?? null,
      title: input.title,
      type: input.type,
      color: input.color,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      order: input.order ?? 0,
    },
  });
  revalidatePath(`/projects/${input.projectId}`);
  return { id: task.id };
}

export async function updateTask(
  id: string,
  input: {
    title: string;
    type: TaskType;
    color: string;
    startDate: string;
    endDate: string;
  }
) {
  await requirePageEdit("projects");

  const task = await prisma.projectTask.update({
    where: { id },
    data: {
      title: input.title,
      type: input.type,
      color: input.color,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
    },
  });
  revalidatePath(`/projects/${task.projectId}`);
}

async function getDescendantTaskIds(taskId: string): Promise<string[]> {
  const ids = [taskId];
  let frontier = [taskId];
  while (frontier.length) {
    const children = await prisma.projectTask.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    ids.push(...childIds);
    frontier = childIds;
  }
  return ids;
}

export async function deleteTask(id: string) {
  await requirePageEdit("projects");

  const task = await prisma.projectTask.findUniqueOrThrow({
    where: { id },
    select: { projectId: true },
  });

  // Alt görevler dahil, etkilenen tüm kişileri topla ki silme sonrası
  // Kaynak Planı'ndaki planlanan gün sayıları yeniden hesaplansın.
  const descendantIds = await getDescendantTaskIds(id);
  const assignees = await prisma.taskAssignee.findMany({
    where: { taskId: { in: descendantIds } },
    select: { memberId: true },
  });
  const memberIds = [...new Set(assignees.map((a) => a.memberId))];

  await prisma.projectTask.delete({ where: { id } }); // alt görevler/atamalar/dağılımlar cascade silinir

  for (const memberId of memberIds) {
    await recomputeAssignmentsForMember(task.projectId, memberId);
  }

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/resources");
}

// ── Atama ────────────────────────────────────────────────

export async function setTaskAssignees(taskId: string, memberIds: string[]) {
  await requirePageEdit("projects");

  const task = await prisma.projectTask.findUniqueOrThrow({
    where: { id: taskId },
    select: { projectId: true },
  });
  const existing = await prisma.taskAssignee.findMany({ where: { taskId } });
  const existingMemberIds = existing.map((e) => e.memberId);
  const toRemove = existing.filter((e) => !memberIds.includes(e.memberId));
  const toAdd = memberIds.filter((m) => !existingMemberIds.includes(m));

  await prisma.$transaction([
    ...toRemove.map((e) => prisma.taskAssignee.delete({ where: { id: e.id } })),
    ...toAdd.map((m) => prisma.taskAssignee.create({ data: { taskId, memberId: m } })),
  ]);

  for (const e of toRemove) {
    await recomputeAssignmentsForMember(task.projectId, e.memberId);
  }

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/resources");
}

// ── Haftalık gün dağılımı ────────────────────────────────

export async function upsertWeekAllocation(input: {
  taskAssigneeId: string;
  year: number;
  week: number;
  days: number;
}) {
  await requirePageEdit("projects");

  const ta = await prisma.taskAssignee.findUniqueOrThrow({
    where: { id: input.taskAssigneeId },
    include: { task: { select: { projectId: true } } },
  });

  await prisma.taskWeekAllocation.upsert({
    where: {
      taskAssigneeId_year_week: {
        taskAssigneeId: input.taskAssigneeId,
        year: input.year,
        week: input.week,
      },
    },
    create: {
      taskAssigneeId: input.taskAssigneeId,
      year: input.year,
      week: input.week,
      days: input.days,
    },
    update: { days: input.days },
  });

  await recomputeAssignmentsForMember(ta.task.projectId, ta.memberId);

  revalidatePath(`/projects/${ta.task.projectId}`);
  revalidatePath("/resources");
}

// Bir kişinin, bu projedeki tüm görev bazlı haftalık gün girişlerini aya toplayıp
// Assignment.plannedDays'e yansıtır (actualDays ve resources dokunulmaz).
async function recomputeAssignmentsForMember(projectId: string, memberId: string) {
  const allocations = await prisma.taskWeekAllocation.findMany({
    where: { taskAssignee: { memberId, task: { projectId } } },
    select: { year: true, week: true, days: true },
  });

  const byMonth = new Map<string, number>();
  for (const a of allocations) {
    const monday = isoWeekMonday(a.year, a.week);
    const key = `${monday.getUTCFullYear()}-${monday.getUTCMonth() + 1}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(a.days));
  }

  for (const [key, days] of byMonth) {
    const [y, m] = key.split("-").map(Number);
    const rounded = Math.round(days * 100) / 100;
    await prisma.assignment.upsert({
      where: { projectId_memberId_year_month: { projectId, memberId, year: y, month: m } },
      create: { projectId, memberId, year: y, month: m, plannedDays: rounded, actualDays: 0 },
      update: { plannedDays: rounded },
    });
  }
}
