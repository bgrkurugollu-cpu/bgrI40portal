import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { AdminClient } from "./admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/");

  const [users, factories, members, applications] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.factory.findMany({
      include: { _count: { select: { projects: true, licenses: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.teamMember.findMany({
      include: { _count: { select: { assignments: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.application.findMany({
      include: { _count: { select: { licenses: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AdminClient
      currentUserId={session.sub}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
      }))}
      factories={factories.map((f) => ({
        id: f.id,
        name: f.name,
        location: f.location,
        projectCount: f._count.projects,
        licenseCount: f._count.licenses,
      }))}
      members={members.map((m) => ({
        id: m.id,
        name: m.name,
        title: m.title,
        active: m.active,
        assignmentCount: m._count.assignments,
      }))}
      applications={applications.map((a) => ({
        id: a.id,
        name: a.name,
        vendor: a.vendor,
        licenseCount: a._count.licenses,
      }))}
    />
  );
}
