import * as XLSX from "xlsx";
import type { ProjectTaskDTO } from "@/lib/types";
import { weekColumnsForYear, weekRangeInYear, daysBetweenInclusive } from "@/lib/isoweek";

const TASK_TYPE_LABELS: Record<string, string> = { TASK: "Görev", MILESTONE: "Milestone" };
const FIXED_HEADERS = ["Başlık", "Tip", "Başlangıç", "Bitiş", "Süre (gün)", "Atananlar", "JIRA Kodu"];

type Node = ProjectTaskDTO & { children: Node[]; depth: number };

function buildTree(tasks: ProjectTaskDTO[]): Node[] {
  const map = new Map<string, Node>();
  tasks.forEach((t) => map.set(t.id, { ...t, children: [], depth: 0 }));
  const roots: Node[] = [];
  map.forEach((node) => {
    const parent = node.parentId ? map.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  function sortAndDepth(nodes: Node[], depth: number) {
    nodes.sort((a, b) => a.order - b.order);
    for (const n of nodes) {
      n.depth = depth;
      sortAndDepth(n.children, depth + 1);
    }
  }
  sortAndDepth(roots, 0);
  return roots;
}

function flattenAll(nodes: Node[], out: Node[] = []): Node[] {
  for (const n of nodes) {
    out.push(n);
    if (n.children.length) flattenAll(n.children, out);
  }
  return out;
}

/**
 * Proje Planı (Gantt) sekmesini, ekrandaki yapıyla (görev/milestone satırları +
 * altlarında kişi bazlı haftalık gün dağılımı) birebir eşleşecek şekilde tek bir
 * Excel sayfasına aktarır: sabit sütunlar + seçili yılın ISO hafta sütunları,
 * ay grubu başlıklarıyla birleştirilmiş (merged) üst satır dahil.
 */
export function exportProjectPlanToExcel(
  project: { projectCode: string; name: string },
  tasks: ProjectTaskDTO[],
  year: number
) {
  const weekCols = weekColumnsForYear(year);
  const tree = buildTree(tasks);
  const flat = flattenAll(tree);

  const headerRow1: (string | number)[] = FIXED_HEADERS.map(() => "");
  const headerRow2: (string | number)[] = [...FIXED_HEADERS];
  const merges: XLSX.Range[] = [];

  for (const c of weekCols) {
    headerRow1.push(c.monthLabel ?? "");
    headerRow2.push(`H${c.week}`);
  }

  // Ay grubu başlıklarını, ekrandaki ay grubu satırıyla aynı mantıkla birleştir:
  // her yeni ay etiketinde bir grup başlar, etiketsiz haftalar önceki gruba eklenir.
  let groupStartCol = -1;
  let span = 0;
  for (let i = 0; i < weekCols.length; i++) {
    const col = FIXED_HEADERS.length + i;
    if (weekCols[i].monthLabel !== null) {
      if (groupStartCol >= 0 && span > 1) {
        merges.push({ s: { r: 0, c: groupStartCol }, e: { r: 0, c: groupStartCol + span - 1 } });
      }
      groupStartCol = col;
      span = 1;
    } else {
      span++;
    }
  }
  if (groupStartCol >= 0 && span > 1) {
    merges.push({ s: { r: 0, c: groupStartCol }, e: { r: 0, c: groupStartCol + span - 1 } });
  }

  const rows: (string | number)[][] = [headerRow1, headerRow2];

  for (const task of flat) {
    const range = weekRangeInYear(task.startDate, task.endDate, year);
    const isMilestone = task.type === "MILESTONE";
    const duration = daysBetweenInclusive(task.startDate, task.endDate);
    const indent = "    ".repeat(task.depth);
    const assigneeNames = task.assignees.map((a) => a.memberName).join(", ");

    const taskRow: (string | number)[] = [
      `${indent}${isMilestone ? "◆ " : ""}${task.title}`,
      TASK_TYPE_LABELS[task.type] ?? task.type,
      task.startDate,
      task.endDate,
      duration,
      assigneeNames,
      task.jiraCode ?? "",
    ];
    for (const c of weekCols) {
      const inRange = range && c.week >= range.startWeek && c.week <= range.endWeek;
      if (!inRange) {
        taskRow.push("");
      } else if (isMilestone) {
        taskRow.push(c.week === range!.startWeek ? "◆" : "");
      } else {
        taskRow.push("■");
      }
    }
    rows.push(taskRow);

    if (!isMilestone) {
      for (const a of task.assignees) {
        const assigneeRow: (string | number)[] = [
          `${indent}    ↳ ${a.memberName}`,
          "",
          "",
          "",
          "",
          "",
          "",
        ];
        for (const c of weekCols) {
          const inRange = range && c.week >= range.startWeek && c.week <= range.endWeek;
          const key = `${year}-${c.week}`;
          const days = a.weekAllocations[key] ?? 0;
          assigneeRow.push(inRange && days > 0 ? days : "");
        }
        rows.push(assigneeRow);
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = merges;
  ws["!cols"] = [
    ...FIXED_HEADERS.map((h, i) => {
      const maxLen = Math.max(h.length, ...rows.slice(2).map((r) => String(r[i] ?? "").length));
      return { wch: Math.min(maxLen + 4, i === 0 ? 45 : 22) };
    }),
    ...weekCols.map(() => ({ wch: 5 })),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Plan ${year}`.slice(0, 31));
  XLSX.writeFile(wb, `${project.projectCode || project.name}_proje_plani_${year}.xlsx`);
}
