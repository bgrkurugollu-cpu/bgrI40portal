"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createProject, updateProject } from "@/app/actions/projects";
import type { FactoryDTO, ProjectDTO } from "@/lib/types";
import { RISK_LABELS, STATUS_LABELS } from "@/lib/utils";

export function ProjectForm({
  factories,
  project,
  onDone,
}: {
  factories: FactoryDTO[];
  project?: ProjectDTO;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      name: String(fd.get("name")),
      factoryId: String(fd.get("factoryId")),
      probability: Number(fd.get("probability")),
      targetBudget: Number(fd.get("targetBudget")),
      startDate: (fd.get("startDate") as string) || null,
      endDate: (fd.get("endDate") as string) || null,
      riskLevel: fd.get("riskLevel") as ProjectDTO["riskLevel"],
      priority: fd.get("priority") as ProjectDTO["priority"],
      status: fd.get("status") as ProjectDTO["status"],
      description: (fd.get("description") as string) || null,
    };
    try {
      if (project) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateProject(project.id, input as any);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await createProject(input as any);
      }
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Proje Adı</Label>
          <Input id="name" name="name" defaultValue={project?.name} required />
        </div>
        <div>
          <Label htmlFor="factoryId">Fabrika</Label>
          <Select id="factoryId" name="factoryId" defaultValue={project?.factoryId} required>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="probability">Gerçekleşme İhtimali (%)</Label>
          <Input
            id="probability"
            name="probability"
            type="number"
            min={0}
            max={100}
            defaultValue={project?.probability ?? 50}
            required
          />
        </div>
        <div>
          <Label htmlFor="targetBudget">Hedef Bütçe (₺)</Label>
          <Input
            id="targetBudget"
            name="targetBudget"
            type="number"
            min={0}
            step="0.01"
            defaultValue={project?.targetBudget ?? 0}
            required
          />
        </div>
        <div>
          <Label htmlFor="status">Durum</Label>
          <Select id="status" name="status" defaultValue={project?.status ?? "PLANNED"}>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="startDate">Başlangıç</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={project?.startDate ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="endDate">Bitiş</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={project?.endDate ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="riskLevel">Risk Derecesi</Label>
          <Select id="riskLevel" name="riskLevel" defaultValue={project?.riskLevel ?? "MEDIUM"}>
            {Object.entries(RISK_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="priority">Öncelik</Label>
          <Select id="priority" name="priority" defaultValue={project?.priority ?? "MEDIUM"}>
            {Object.entries(RISK_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2">
          <Label htmlFor="description">Açıklama</Label>
          <Input
            id="description"
            name="description"
            defaultValue={project?.description ?? ""}
            placeholder="Kısa açıklama"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Vazgeç
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {project ? "Güncelle" : "Oluştur"}
        </Button>
      </div>
    </form>
  );
}
