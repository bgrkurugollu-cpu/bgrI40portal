import { prisma } from "@/lib/db";
import type { AssignmentDTO, MemberDTO } from "@/lib/types";
import { ResourcesClient } from "./resources-client";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const [assignments, members, projects] = await Promise.all([
    prisma.assignment.findMany({
      include: { member: true, project: true },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    }),
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ select: { id: true, name: true } }),
  ]);

  const dtos: (AssignmentDTO & { projectName: string })[] = assignments.map((a) => ({
    id: a.id,
    projectId: a.projectId,
    projectName: a.project.name,
    memberId: a.memberId,
    memberName: a.member.name,
    year: a.year,
    month: a.month,
    plannedDays: Number(a.plannedDays),
    actualDays: Number(a.actualDays),
    resources: a.resources,
  }));

  const memberDtos: MemberDTO[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    title: m.title,
  }));

  return (
    <ResourcesClient
      assignments={dtos}
      members={memberDtos}
      projects={projects}
    />
  );
}
