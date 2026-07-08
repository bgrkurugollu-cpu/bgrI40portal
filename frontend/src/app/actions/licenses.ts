"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { Currency, LicenseStatus, PaymentPeriod } from "@prisma/client";

type LicenseInput = {
  applicationId: string;
  factoryId: string;
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
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");

  await prisma.license.create({
    data: {
      ...input,
      renewalDate: input.renewalDate ? new Date(input.renewalDate) : null,
    },
  });
  revalidatePath("/licenses");
  revalidatePath("/");
}

export async function updateLicense(id: string, input: LicenseInput) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");

  await prisma.license.update({
    where: { id },
    data: {
      ...input,
      renewalDate: input.renewalDate ? new Date(input.renewalDate) : null,
    },
  });
  revalidatePath("/licenses");
}

export async function deleteLicense(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");
  await prisma.license.delete({ where: { id } });
  revalidatePath("/licenses");
}

export async function createApplication(input: { name: string; vendor: string | null }) {
  const session = await getSession();
  if (!session) throw new Error("Yetkisiz");
  const app = await prisma.application.create({ data: input });
  revalidatePath("/licenses");
  return { id: app.id };
}
