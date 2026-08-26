import { prisma } from "@/lib/db";
import type { PtDTO } from "@/lib/types";
import { PtClient } from "./pt-client";

export const dynamic = "force-dynamic";

export default async function PtPage() {
  const items = await prisma.pt.findMany({ orderBy: { createdAt: "desc" } });

  const dtos: PtDTO[] = items.map((p) => ({
    id: p.id,
    ptCode: p.ptCode,
    pipelineCode: p.pipelineCode,
    name: p.name,
    description: p.description,
    status: p.status,
  }));

  return <PtClient items={dtos} />;
}
