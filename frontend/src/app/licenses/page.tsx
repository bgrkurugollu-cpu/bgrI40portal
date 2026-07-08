import { prisma } from "@/lib/db";
import type { ApplicationDTO, FactoryDTO, LicenseDTO, RatesDTO } from "@/lib/types";
import { getRates, toTRY } from "@/lib/rates";
import type { CurrencyCode } from "@/lib/utils";
import { LicensesClient } from "./licenses-client";

export const dynamic = "force-dynamic";

export default async function LicensesPage() {
  const [rates, licenses, applications, factories] = await Promise.all([
    getRates(),
    prisma.license.findMany({
      include: { application: true, factory: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.application.findMany({ orderBy: { name: "asc" } }),
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
  ]);

  const dtos: LicenseDTO[] = licenses.map((l) => {
    const currency = l.currency as CurrencyCode;
    return {
      id: l.id,
      applicationId: l.applicationId,
      applicationName: l.application.name,
      vendor: l.application.vendor,
      factoryId: l.factoryId,
      factoryName: l.factory.name,
      licenseKey: l.licenseKey,
      description: l.description,
      totalInvestment: Number(l.totalInvestment),
      isSubscription: l.isSubscription,
      subscriptionCost: Number(l.subscriptionCost),
      currency,
      totalInvestmentTRY: toTRY(Number(l.totalInvestment), currency, rates),
      subscriptionCostTRY: toTRY(Number(l.subscriptionCost), currency, rates),
      paymentPeriod: l.paymentPeriod,
      renewalDate: l.renewalDate?.toISOString().slice(0, 10) ?? null,
      status: l.status,
    };
  });

  const appDtos: ApplicationDTO[] = applications.map((a) => ({
    id: a.id,
    name: a.name,
    vendor: a.vendor,
  }));
  const factoryDtos: FactoryDTO[] = factories.map((f) => ({
    id: f.id,
    name: f.name,
    location: f.location,
  }));

  const ratesDto: RatesDTO = {
    TRY: rates.TRY,
    USD: rates.USD,
    EUR: rates.EUR,
    GBP: rates.GBP,
    date: rates.date,
    source: rates.source,
  };

  return (
    <LicensesClient
      licenses={dtos}
      applications={appDtos}
      factories={factoryDtos}
      rates={ratesDto}
    />
  );
}
