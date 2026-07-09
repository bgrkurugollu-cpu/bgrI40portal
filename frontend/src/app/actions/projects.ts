"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { Priority, ProjectStatus, RiskLevel } from "@prisma/client";

type ProjectInput = {
  projectCode: string;
  name: string;
  factoryIds: string[];
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
  if (input.factoryIds.length === 0) throw new Error("En az bir fabrika seçilmelidir.");

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  const validUserId = user ? user.id : null;

  const { factoryIds, ...rest } = input;
  const project = await prisma.project.create({
    data: {
      ...rest,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      factories: { connect: factoryIds.map((id) => ({ id })) },
    },
  });
  await prisma.projectLog.create({
    data: {
      projectId: project.id,
      userId: validUserId,
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
  if (input.factoryIds.length === 0) throw new Error("En az bir fabrika seçilmelidir.");

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  const validUserId = user ? user.id : null;

  const existing = await prisma.project.findUniqueOrThrow({
    where: { id },
    include: { factories: true },
  });

  const { factoryIds, ...scalarInput } = input;
  const next = {
    ...scalarInput,
    startDate: input.startDate ? new Date(input.startDate) : null,
    endDate: input.endDate ? new Date(input.endDate) : null,
  };

  // Tarihsel log: değişen her skalar alan için kayıt (fabrika ayrı ele alınır)
  const fields: (keyof typeof next)[] = [
    "projectCode",
    "name",
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
        userId: validUserId,
        field: f as string,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  // Fabrika değişikliğini isim kümesi karşılaştırmasıyla logla
  const oldFactoryNames = existing.factories.map((f) => f.name).sort();
  const newFactories = await prisma.factory.findMany({ where: { id: { in: factoryIds } } });
  const newFactoryNames = newFactories.map((f) => f.name).sort();
  if (oldFactoryNames.join(", ") !== newFactoryNames.join(", ")) {
    logs.push({
      projectId: id,
      userId: validUserId,
      field: "factories",
      oldValue: oldFactoryNames.join(", "),
      newValue: newFactoryNames.join(", "),
    });
  }

  await prisma.$transaction([
    prisma.project.update({
      where: { id },
      data: { ...next, factories: { set: factoryIds.map((fid) => ({ id: fid })) } },
    }),
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
