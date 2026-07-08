"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { Priority, ProjectStatus, RiskLevel } from "@prisma/client";

type ProjectInput = {
  projectCode: string;
  name: string;
  factoryId: string;
  probability: number;
  targetBudget: number;
  startDate: string | null;
  endDate: string | null;
  riskLevel: RiskLevel;
  priority: Priority;
  status: ProjectStatus;
  description: string | null;
};

export async function createProject(input: ProjectInput) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");

  const project = await prisma.project.create({
    data: {
      ...input,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
  });
  await prisma.projectLog.create({
    data: {
      projectId: project.id,
      userId: session.sub,
      field: "oluşturma",
      newValue: "Proje oluşturuldu",
    },
  });
  revalidatePath("/projects");
  revalidatePath("/");
  return { id: project.id };
}

export async function updateProject(id: string, input: ProjectInput) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");

  const existing = await prisma.project.findUniqueOrThrow({ where: { id } });

  const next = {
    ...input,
    startDate: input.startDate ? new Date(input.startDate) : null,
    endDate: input.endDate ? new Date(input.endDate) : null,
  };

  // Tarihsel log: değişen her alan için kayıt
  const fields: (keyof ProjectInput)[] = [
    "projectCode",
    "name",
    "factoryId",
    "probability",
    "targetBudget",
    "startDate",
    "endDate",
    "riskLevel",
    "priority",
    "status",
    "description",
  ];
  const logs = [];
  for (const f of fields) {
    const oldVal =
      existing[f as keyof typeof existing] instanceof Date
        ? (existing[f as keyof typeof existing] as Date).toISOString().slice(0, 10)
        : String(existing[f as keyof typeof existing] ?? "");
    const newVal =
      next[f as keyof typeof next] instanceof Date
        ? (next[f as keyof typeof next] as Date).toISOString().slice(0, 10)
        : String(next[f as keyof typeof next] ?? "");
    if (oldVal !== newVal) {
      logs.push({
        projectId: id,
        userId: session.sub,
        field: f,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  await prisma.$transaction([
    prisma.project.update({ where: { id }, data: next }),
    ...(logs.length ? [prisma.projectLog.createMany({ data: logs })] : []),
  ]);

  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function upsertAssignment(input: {
  projectId: string;
  memberId: string;
  year: number;
  month: number;
  plannedDays: number;
  actualDays: number;
  resources?: string | null;
}) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");

  await prisma.assignment.upsert({
    where: {
      projectId_memberId_year_month: {
        projectId: input.projectId,
        memberId: input.memberId,
        year: input.year,
        month: input.month,
      },
    },
    create: input,
    update: {
      plannedDays: input.plannedDays,
      actualDays: input.actualDays,
      resources: input.resources,
    },
  });
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath("/resources");
}

export async function deleteAssignment(id: string, projectId: string) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");
  await prisma.assignment.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/resources");
}
