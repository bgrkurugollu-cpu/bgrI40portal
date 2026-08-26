"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePageEdit } from "@/lib/permission-guard";
import type { Currency, LicenseStatus, PaymentPeriod } from "@prisma/client";

type LicenseInput = {
  applicationId: string;
  factoryIds: string[];
  licenseKey: string;
  description: string | null;
  totalInvestment: number;
  isSubscription: boolean;
  subscriptionCost: number;
  currency: Currency;
  paymentPeriod: PaymentPeriod;
  renewalDate: string | null;
  status: LicenseStatus;
};

export async function createLicense(input: LicenseInput) {
  await requirePageEdit("licenses");
  if (input.factoryIds.length === 0) throw new Error("En az bir fabrika seçilmelidir.");

  const { factoryIds, renewalDate, ...rest } = input;
  await prisma.license.create({
    data: {
      ...rest,
      renewalDate: renewalDate ? new Date(renewalDate) : null,
      factories: { connect: factoryIds.map((id) => ({ id })) },
    },
  });
  revalidatePath("/licenses");
  revalidatePath("/");
}

export async function updateLicense(id: string, input: LicenseInput) {
  await requirePageEdit("licenses");
  if (input.factoryIds.length === 0) throw new Error("En az bir fabrika seçilmelidir.");

  const { factoryIds, renewalDate, ...rest } = input;
  await prisma.license.update({
    where: { id },
    data: {
      ...rest,
      renewalDate: renewalDate ? new Date(renewalDate) : null,
      factories: { set: factoryIds.map((id) => ({ id })) },
    },
  });
  revalidatePath("/licenses");
}

export async function deleteLicense(id: string) {
  await requirePageEdit("licenses");
  await prisma.license.delete({ where: { id } });
  revalidatePath("/licenses");
}

export async function createApplication(input: { name: string; vendor: string | null }) {
  await requirePageEdit("licenses");
  const app = await prisma.application.create({ data: input });
  revalidatePath("/licenses");
  return { id: app.id };
}
