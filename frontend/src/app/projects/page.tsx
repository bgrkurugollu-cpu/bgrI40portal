import { prisma } from "@/lib/db";
import type { ProjectDTO } from "@/lib/types";
import { ProjectsClient } from "./projects-client";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, factories] = await Promise.all([
    prisma.project.findMany({
      include: { factories: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
  ]);

  const dtos: ProjectDTO[] = projects.map((p) => ({
    id: p.id,
    projectCode: p.projectCode,
    name: p.name,
    factoryIds: p.factories.map((f) => f.id),
    factoryNames: p.factories.map((f) => f.name),
    probability: p.probability,
    targetBudget: Number(p.targetBudget),
    startDate: p.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: p.endDate?.toISOString().slice(0, 10) ?? null,
    riskLevel: p.riskLevel,
    priority: p.priority,
    status: p.status,
    description: p.description,
  }));

  return (
    <ProjectsClient
      projects={dtos}
      factories={factories.map((f) => ({
        id: f.id,
        name: f.name,
        location: f.location,
      }))}
    />
  );
}
