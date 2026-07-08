import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("Seed atlandı: veritabanı zaten dolu.");
    return;
  }

  // Admin kullanıcı
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      email: "admin@bgr.local",
      name: "Yönetici",
      passwordHash,
      role: "ADMIN",
    },
  });

  // Fabrikalar
  const [f1, f2, f3] = await Promise.all(
    [
      { name: "Gebze Fabrikası", location: "Gebze / Kocaeli" },
      { name: "İzmir Fabrikası", location: "Aliağa / İzmir" },
      { name: "Bursa Fabrikası", location: "Nilüfer / Bursa" },
    ].map((d) => prisma.factory.create({ data: d }))
  );

  // 6 kişilik Endüstri 4.0 ekibi
  const memberNames: [string, string][] = [
    ["Ahmet Yılmaz", "Takım Lideri"],
    ["Elif Demir", "MES Uzmanı"],
    ["Mehmet Kaya", "SCADA Mühendisi"],
    ["Zeynep Arslan", "Veri Mühendisi"],
    ["Can Öztürk", "Otomasyon Mühendisi"],
    ["Selin Çelik", "Yazılım Geliştirici"],
  ];
  const members = await Promise.all(
    memberNames.map(([name, title]) =>
      prisma.teamMember.create({ data: { name, title } })
    )
  );

  // Projeler
  const p1 = await prisma.project.create({
    data: {
      name: "MES Entegrasyonu",
      factoryId: f1.id,
      probability: 90,
      targetBudget: 2500000,
      startDate: new Date("2026-01-15"),
      endDate: new Date("2026-11-30"),
      riskLevel: "MEDIUM",
      priority: "HIGH",
      status: "ACTIVE",
      description: "Üretim yürütme sistemi (MES) kurulumu ve ERP entegrasyonu.",
    },
  });
  const p2 = await prisma.project.create({
    data: {
      name: "Enerji İzleme Sistemi",
      factoryId: f2.id,
      probability: 70,
      targetBudget: 850000,
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-09-30"),
      riskLevel: "LOW",
      priority: "MEDIUM",
      status: "ACTIVE",
      description: "Fabrika geneli enerji tüketimi izleme ve raporlama altyapısı.",
    },
  });
  const p3 = await prisma.project.create({
    data: {
      name: "Kestirimci Bakım Pilot",
      factoryId: f3.id,
      probability: 50,
      targetBudget: 1200000,
      startDate: new Date("2026-06-01"),
      endDate: new Date("2027-02-28"),
      riskLevel: "HIGH",
      priority: "CRITICAL",
      status: "PLANNED",
      description: "Kritik ekipmanlarda titreşim/sıcaklık verisiyle kestirimci bakım pilotu.",
    },
  });

  // Proje logları
  await prisma.projectLog.createMany({
    data: [
      { projectId: p1.id, field: "oluşturma", newValue: "Proje oluşturuldu" },
      { projectId: p1.id, field: "probability", oldValue: "75", newValue: "90" },
      { projectId: p2.id, field: "oluşturma", newValue: "Proje oluşturuldu" },
      { projectId: p3.id, field: "oluşturma", newValue: "Proje oluşturuldu" },
      { projectId: p3.id, field: "riskLevel", oldValue: "MEDIUM", newValue: "HIGH" },
    ],
  });

  // Atamalar: 2026 yılı için örnek plan/gerçekleşen adam-gün
  const assignments: {
    projectId: string;
    memberId: string;
    year: number;
    month: number;
    plannedDays: number;
    actualDays: number;
    resources?: string;
  }[] = [];
  const plan = (
    projectId: string,
    memberIdx: number,
    months: number[],
    planned: number,
    actualUntil: number
  ) => {
    for (const m of months) {
      assignments.push({
        projectId,
        memberId: members[memberIdx].id,
        year: 2026,
        month: m,
        plannedDays: planned,
        actualDays: m <= actualUntil ? Math.round(planned * (0.7 + Math.random() * 0.5)) : 0,
        resources: memberIdx % 2 === 0 ? "Laptop, Ignition Dev" : undefined,
      });
    }
  };
  plan(p1.id, 0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 8, 6);
  plan(p1.id, 1, [2, 3, 4, 5, 6, 7, 8, 9], 15, 6);
  plan(p1.id, 5, [3, 4, 5, 6, 7, 8], 12, 6);
  plan(p2.id, 2, [3, 4, 5, 6, 7, 8, 9], 10, 6);
  plan(p2.id, 3, [4, 5, 6, 7, 8], 12, 6);
  plan(p3.id, 3, [6, 7, 8, 9, 10, 11, 12], 8, 6);
  plan(p3.id, 4, [6, 7, 8, 9, 10, 11, 12], 15, 6);
  await prisma.assignment.createMany({ data: assignments });

  // Bütçe kalemleri
  await prisma.budgetItem.createMany({
    data: [
      { projectId: p1.id, category: "Yazılım", description: "MES lisansları", quantity: 1, unitPrice: 18000, amount: 18000, currency: "USD" },
      { projectId: p1.id, category: "Donanım", description: "Endüstriyel PC ve sunucular", quantity: 6, unitPrice: 85000, amount: 510000, currency: "TRY" },
      { projectId: p1.id, category: "İşçilik", description: "Danışmanlık ve devreye alma", quantity: 120, unitPrice: 6500, amount: 780000, currency: "TRY" },
      { projectId: p2.id, category: "Donanım", description: "Enerji analizörleri", quantity: 40, unitPrice: 9500, amount: 380000, currency: "TRY" },
      { projectId: p2.id, category: "Yazılım", description: "İzleme platformu lisansı", quantity: 1, unitPrice: 5000, amount: 5000, currency: "EUR" },
      { projectId: p3.id, category: "Donanım", description: "Titreşim sensörleri", quantity: 60, unitPrice: 7000, amount: 420000, currency: "TRY" },
      { projectId: p3.id, category: "Yazılım", description: "ML platformu aboneliği", quantity: 1, unitPrice: 300000, amount: 300000, currency: "TRY" },
    ],
  });

  // Aylık finansal grid (2026). Kural: gelir = gider * 1.05.
  const MARKUP = 1.05;
  const fin: {
    projectId: string;
    year: number;
    month: number;
    income: number;
    expense: number;
    internalIncome: number;
    currency: "TRY" | "USD" | "EUR" | "GBP";
  }[] = [];
  const finRow = (
    projectId: string,
    month: number,
    expense: number,
    internalIncome: number,
    currency: "TRY" | "USD" | "EUR" | "GBP" = "TRY"
  ) =>
    fin.push({
      projectId,
      year: 2026,
      month,
      expense,
      income: Math.round(expense * MARKUP * 100) / 100,
      internalIncome,
      currency,
    });
  finRow(p1.id, 1, 120000, 40000);
  finRow(p1.id, 3, 210000, 40000);
  finRow(p1.id, 6, 180000, 40000);
  finRow(p1.id, 9, 150000, 40000);
  finRow(p1.id, 11, 90000, 40000);
  finRow(p2.id, 3, 150000, 20000);
  finRow(p2.id, 5, 4000, 20000, "USD"); // dolar bazlı örnek gider
  finRow(p2.id, 8, 60000, 20000);
  finRow(p3.id, 6, 200000, 30000);
  finRow(p3.id, 9, 5000, 30000, "EUR"); // euro bazlı örnek gider
  finRow(p3.id, 12, 120000, 30000);
  await prisma.monthlyFinancial.createMany({ data: fin });

  // Faturalar
  await prisma.invoice.createMany({
    data: [
      { projectId: p1.id, description: "MES Faz 1 - Avans", amount: 500000, currency: "TRY", issueDate: new Date("2026-03-15"), status: "PAID" },
      { projectId: p1.id, description: "MES Faz 1 - Ara hakediş", amount: 750000, currency: "TRY", issueDate: new Date("2026-06-15"), status: "ISSUED" },
      { projectId: p1.id, description: "MES Faz 1 - Hakediş 2", amount: 600000, currency: "TRY", issueDate: new Date("2026-09-15"), status: "PLANNED" },
      { projectId: p2.id, description: "Enerji izleme - Kurulum", amount: 8000, currency: "USD", issueDate: new Date("2026-05-20"), status: "PAID" },
      { projectId: p2.id, description: "Enerji izleme - Kabul", amount: 350000, currency: "TRY", issueDate: new Date("2026-08-20"), status: "PLANNED" },
      { projectId: p3.id, description: "Kestirimci bakım - Pilot başlangıç", amount: 400000, currency: "TRY", issueDate: new Date("2026-09-30"), status: "PLANNED" },
    ],
  });

  // Uygulamalar ve lisanslar
  const [ignition, aveva, msSql] = await Promise.all(
    [
      { name: "Ignition", vendor: "Inductive Automation" },
      { name: "AVEVA System Platform", vendor: "AVEVA" },
      { name: "SQL Server", vendor: "Microsoft" },
    ].map((d) => prisma.application.create({ data: d }))
  );
  await prisma.license.createMany({
    data: [
      {
        applicationId: ignition.id,
        factoryId: f1.id,
        licenseKey: "IGN-8X2K-9F4M-A1B2",
        description: "Ignition Platform - Unlimited tags, Gebze MES sunucusu",
        totalInvestment: 9500,
        isSubscription: true,
        subscriptionCost: 1900,
        currency: "USD",
        paymentPeriod: "YEARLY",
        renewalDate: new Date("2026-09-01"),
        status: "ACTIVE",
      },
      {
        applicationId: ignition.id,
        factoryId: f2.id,
        licenseKey: "IGN-3C7D-1E5F-G6H7",
        description: "Ignition Edge - Enerji izleme gateway",
        totalInvestment: 120000,
        isSubscription: true,
        subscriptionCost: 25000,
        paymentPeriod: "YEARLY",
        renewalDate: new Date("2026-08-10"),
        status: "EXPIRING",
      },
      {
        applicationId: aveva.id,
        factoryId: f3.id,
        licenseKey: "AVV-PLT-2024-XY99",
        description: "System Platform 2023 - 25K IO",
        totalInvestment: 16000,
        isSubscription: false,
        currency: "EUR",
        paymentPeriod: "ONE_TIME",
        status: "ACTIVE",
      },
      {
        applicationId: msSql.id,
        factoryId: f1.id,
        licenseKey: "MSSQL-STD-2022-4CORE",
        description: "SQL Server 2022 Standard - MES veritabanı",
        totalInvestment: 180000,
        isSubscription: true,
        subscriptionCost: 15000,
        paymentPeriod: "MONTHLY",
        renewalDate: new Date("2026-07-25"),
        status: "ACTIVE",
      },
    ],
  });

  console.log("Seed tamamlandı. Giriş: admin@bgr.local / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
