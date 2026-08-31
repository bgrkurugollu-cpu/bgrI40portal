// Client bileşenlerine geçirilen düz (serializable) tipler

import type { CurrencyCode } from "@/lib/utils";

// TCMB kurları — client'a da geçirilebilen düz yapı
export type RatesDTO = {
  TRY: number;
  USD: number;
  EUR: number;
  GBP: number;
  date: string;
  time?: string;
  source: "TCMB" | "fallback";
};

export type FactoryDTO = { id: string; name: string; location: string | null };

export type ProjectDTO = {
  id: string;
  kind: "PROJECT" | "LEAD" | "CR";
  projectCode: string;
  pipelineCode: string | null;
  name: string;
  factoryIds: string[];
  factoryNames: string[];
  probability: number;
  targetBudget: number;
  startDate: string | null;
  endDate: string | null;
  riskLevel: string;
  priority: string;
  status: string;
  description: string | null;
  jiraLink: string | null;
};

export type MemberDTO = { id: string; name: string; title: string | null };

export type AssignmentDTO = {
  id: string;
  projectId: string;
  projectCode?: string;
  projectName?: string;
  memberId: string;
  memberName: string;
  year: number;
  month: number;
  plannedDays: number;
  actualDays: number;
  resources: string | null;
};

export type BudgetItemDTO = {
  id: string;
  projectId?: string;
  projectCode?: string;
  projectName?: string;
  year: number;
  expenseType: "CAPEX" | "OPEX";
  category: string;
  description: string;
  supplier: string | null;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency: CurrencyCode;
  amountTRY: number;
  note: string | null;
  transferFeePercent: number | null;
  transferPrice: number | null;
};

export type FinancialDTO = {
  id: string;
  projectId: string;
  projectCode?: string;
  projectName?: string;
  year: number;
  month: number;
  income: number;
  expense: number;
  internalIncome: number;
  currency: CurrencyCode;
  // TCMB kuru ile TL'ye çevrilmiş değerler (raporlama için)
  incomeTRY: number;
  expenseTRY: number;
  internalIncomeTRY: number;
};

export type InvoiceDTO = {
  id: string;
  projectId: string;
  projectCode?: string;
  projectName?: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  amountTRY: number;
  issueDate: string;
  status: string;
  ebaNumber: string | null;
  poNumber: string | null;
  hasExchangeRateDiff: boolean;
  exchangeRateDiffEbaNumber: string | null;
};

export type PaymentPlanItemDTO = {
  id: string;
  projectId: string;
  projectCode?: string;
  projectName?: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  amountTRY: number;
  dueDate: string;
  status: string;
  note: string | null;
};

export type PtDTO = {
  id: string;
  ptCode: string;
  pipelineCode: string | null;
  name: string;
  description: string | null;
  status: string;
};

export type PtInvoiceDTO = {
  id: string;
  ptId: string;
  ptCode?: string;
  ptName?: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  amountTRY: number;
  issueDate: string;
  status: string;
  ebaNumber: string | null;
  poNumber: string | null;
  hasExchangeRateDiff: boolean;
  exchangeRateDiffEbaNumber: string | null;
};

export type PtMonthlyFinancialDTO = {
  id: string;
  ptId: string;
  year: number;
  month: number;
  income: number;
  expense: number;
  currency: CurrencyCode;
  incomeTRY: number;
  expenseTRY: number;
};

export type LogDTO = {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  userName: string | null;
};

export type LicenseDTO = {
  id: string;
  applicationId: string;
  applicationName: string;
  vendor: string | null;
  factoryIds: string[];
  factoryNames: string[];
  licenseKey: string;
  description: string | null;
  totalInvestment: number;
  isSubscription: boolean;
  subscriptionCost: number;
  currency: CurrencyCode;
  totalInvestmentTRY: number;
  subscriptionCostTRY: number;
  paymentPeriod: string;
  renewalDate: string | null;
  status: string;
};

export type ApplicationDTO = { id: string; name: string; vendor: string | null };

// ── Proje Planı (Gantt) ──────────────────────────────────

export type TaskAssigneeDTO = {
  id: string; // TaskAssignee id
  memberId: string;
  memberName: string;
  // key: `${year}-${week}` → gün sayısı
  weekAllocations: Record<string, number>;
};

export type ProjectTaskDTO = {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  type: "TASK" | "MILESTONE";
  color: string;
  startDate: string;
  endDate: string;
  order: number;
  jiraCode: string | null;
  jiraLink: string | null;
  assignees: TaskAssigneeDTO[];
};

// ── Dijital CAPEX Bütçesi ─────────────────────────────────

export type CapexSubItemDTO = {
  id: string;
  mainItemId: string;
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  title: string;
  budget: number;
  note: string | null;
  order: number;
};

export type CapexMainItemDTO = {
  id: string;
  capexBudgetId: string;
  title: string;
  budget: number;
  spent: number;
  description: string | null;
  order: number;
  factoryIds: string[];
  factoryNames: string[];
  subItems: CapexSubItemDTO[];
};

export type CapexBudgetDTO = {
  id: string;
  year: number;
  currency: CurrencyCode;
  title: string | null;
  totalBudget: number;
  mainItems: CapexMainItemDTO[];
};
