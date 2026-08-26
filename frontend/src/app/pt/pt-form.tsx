"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createPt, updatePt } from "@/app/actions/pt";
import type { PtDTO } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/utils";

export function PtForm({ pt, onDone }: { pt?: PtDTO; onDone: () => void }) {
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      ptCode: String(fd.get("ptCode")),
      pipelineCode: (fd.get("pipelineCode") as string) || null,
      name: String(fd.get("name")),
      description: (fd.get("description") as string) || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: fd.get("status") as any,
    };
    try {
      if (pt) {
        await updatePt(pt.id, input);
      } else {
        await createPt(input);
      }
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="ptCode">PT Kodu</Label>
          <Input
            id="ptCode"
            name="ptCode"
            defaultValue={pt?.ptCode}
            placeholder="Örn. PT-101"
            required
          />
        </div>
        <div>
          <Label htmlFor="pipelineCode">Pipeline Kodu (PTM)</Label>
          <Input
            id="pipelineCode"
            name="pipelineCode"
            defaultValue={pt?.pipelineCode ?? ""}
            placeholder="Örn. PTM-1234"
          />
        </div>
        <div>
          <Label htmlFor="name">PT Adı</Label>
          <Input id="name" name="name" defaultValue={pt?.name} required />
        </div>
        <div>
          <Label htmlFor="status">Durum</Label>
          <Select id="status" name="status" defaultValue={pt?.status ?? "ACTIVE"}>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
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
            defaultValue={pt?.description ?? ""}
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
          {pt ? "Güncelle" : "Oluştur"}
        </Button>
      </div>
    </form>
  );
}
