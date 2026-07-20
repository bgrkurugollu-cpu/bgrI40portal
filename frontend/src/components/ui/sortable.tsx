"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TH } from "./table";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";
export type SortValue = string | number | null | undefined;

/**
 * Genel amaçlı tablo sıralama kancası. `getValue(row, key)` her sütun için
 * karşılaştırılabilir bir değer döner (sayı → sayısal, metin → Türkçe locale).
 * Boş (null/undefined) değerler her zaman sona konur.
 */
export function useSort<T>(
  rows: T[],
  getValue: (row: T, key: string) => SortValue,
  initial?: { key: string; dir?: SortDir }
) {
  const [sortKey, setSortKey] = useState<string | null>(initial?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(initial?.dir ?? "asc");

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = getValue(a, sortKey);
      const vb = getValue(b, sortKey);
      const na = va === null || va === undefined;
      const nb = vb === null || vb === undefined;
      if (na && nb) return 0;
      if (na) return 1;
      if (nb) return -1;
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "tr", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
    // getValue kasıtlı olarak stabil kabul edilir (her render yeni referans olsa da mantığı değişmez)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return { sorted, sortKey, sortDir, toggleSort };
}

/** Tıklanabilir, sıralama yönünü gösteren tablo başlığı. */
export function SortTH({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  className,
  align = "left",
}: {
  label: ReactNode;
  col: string;
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  const active = sortKey === col;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TH
      className={cn(
        "cursor-pointer select-none whitespace-nowrap hover:text-foreground",
        className
      )}
      onClick={() => onSort(col)}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1",
          align === "right" && "flex-row-reverse",
          align === "center" && "justify-center"
        )}
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", active ? "text-foreground" : "opacity-40")} />
      </span>
    </TH>
  );
}
