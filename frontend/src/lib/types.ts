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
  projectCode: string;
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
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency: CurrencyCode;
  amountTRY: number;
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
