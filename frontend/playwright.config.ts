import { defineConfig, devices } from "@playwright/test";

/**
 * Endüstri 4.0 Yönetim Portalı — Playwright E2E test yapılandırması.
 *
 * Testler çalışan bir uygulama + PostgreSQL gerektirir.
 * Lokal: önce `docker compose up -d` sonra `npm run test:e2e`
 * CI: webServer bloğu ile otomatik olarak ayağa kaldırılabilir.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // DB paylaşıldığından sıralı çalıştır
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "tr-TR",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Opsiyonel: CI'da uygulamayı otomatik başlat */
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
